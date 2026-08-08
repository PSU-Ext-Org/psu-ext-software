package com.psuext.connection;

/*-
 * #%L
 * PSU-BE Connection
 * %%
 * Copyright (C) 2026 The PSU-EXT Authors
 * %%
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *      http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * #L%
 */

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import java.time.Duration;

import com.psuext.connection.data.BinaryDataFrame;
import com.psuext.connection.data.TypedScpiQueryResult;
import com.psuext.connection.device.DeviceConnection;
import com.psuext.connection.device.DeviceConnectionPatch;
import com.psuext.connection.device.DeviceConnectionType;
import com.psuext.connection.service.ConnectionManagementService;
import com.psuext.test.scpi.FakeScpiTcpServer;
import com.psuext.test.usb.JSerialCommTestPlatformResolver;
import com.psuext.transport.TransportAutoConfiguration;
import com.psuext.transport.core.model.ScpiTransportResponse;
import com.psuext.transport.core.model.ScpiTransportState;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class ConnectionManagementServiceTest {

    private static final String IDN_RESPONSE = "PSU-EXT,PSU-EXT,TEST-0001,0.1.0";
    private static final String VOLTAGE_RESPONSE = "12.34";
    private static final byte[] BINARY_DATA_RESPONSE = new byte[] {'#', '1', '4', 0x01, 0x02, 0x03, 0x04};

    @TempDir
    Path tempDir;

    @Test
    void supportsCrudStatusRawCommandAndTypedData() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start()
                .respondTo("*IDN?", IDN_RESPONSE)
                .respondTo("MEAS:VOLT?", VOLTAGE_RESPONSE)
                .respondBinaryTo("MEAS:VOLT:DATA? CH1", BINARY_DATA_RESPONSE)) {
            withService(tempDir.resolve("devices.json"), service -> {
                DeviceConnection added = service.addDevice(createTCPDevice("PSU1", server.port()));

                assertThat(service.connect("PSU1").ok()).isTrue();
                assertThat(service.status("PSU1")
                        .transportStatus().state()).isEqualTo(ScpiTransportState.CONNECTED);
                assertTextResponse(service.send("PSU1", "*IDN?"), IDN_RESPONSE);
                assertTextResponse(service.send("PSU1", "MEAS:VOLT?"), VOLTAGE_RESPONSE);

                TypedScpiQueryResult typed = service.queryTypedData("PSU1", "MEAS:VOLT:DATA? CH1");

                assertThat(typed.ok()).isTrue();
                assertThat(typed.data())
                        .isInstanceOfSatisfying(BinaryDataFrame.class, data -> {
                            assertThat(data.command()).isEqualTo("MEAS:VOLT:DATA? CH1");
                            assertThat(data.payload()).containsExactly(0x01, 0x02, 0x03, 0x04);
                        });
                assertThat(service.deleteDevice(String.valueOf(added.id())).name()).isEqualTo("PSU1");
            });
        }
    }

    @Test
    void disconnectsLiveTransportWhenDeviceIsEdited() throws Exception {
        try (FakeScpiTcpServer first = FakeScpiTcpServer.start();
                FakeScpiTcpServer second = FakeScpiTcpServer.start()) {
            withService(tempDir.resolve("edited-devices.json"), service -> {
                service.addDevice(createTCPDevice("PSU2", first.port()));
                assertThat(service.connect("PSU2").ok()).isTrue();

                service.modifyDevice("PSU2", new DeviceConnectionPatch(
                        null,
                        null,
                        null,
                        String.valueOf(second.port()),
                        null));

                assertThat(service.status("PSU2").transportStatus().state())
                        .isEqualTo(ScpiTransportState.DISCONNECTED);
                assertThat(connectionClosed(first)).isTrue();
                assertThat(service.connect("PSU2").ok()).isTrue();
            });
        }
    }

    @Test
    void createsTcpTransportAfterUsbProfileChangesToTcp() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start()) {
            withService(tempDir.resolve("changed-transport-devices.json"), service -> {
                service.addDevice(createUsbDevice());
                service.connect("USB1");

                service.modifyDevice("USB1", new DeviceConnectionPatch(
                        null,
                        DeviceConnectionType.TCP,
                        "127.0.0.1",
                        String.valueOf(server.port()),
                        null));

                assertThat(service.connect("USB1").ok()).isTrue();
                assertThat(server.acceptCount()).isEqualTo(1);
            });
        }
    }

    private static DeviceConnection createUsbDevice() {
        return new DeviceConnection(-1, "USB1", DeviceConnectionType.USB, null,
                "NO_SUCH_SERIAL_PORT", 115200);
    }

    private static DeviceConnection createTCPDevice(String name, int port) {
        return new DeviceConnection(-1, name, DeviceConnectionType.TCP,
                "127.0.0.1", String.valueOf(port), null);
    }

    private static boolean connectionClosed(FakeScpiTcpServer server) {
        try {
            return server.closedConnectionObserved(Duration.ofSeconds(1));
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new AssertionError("Interrupted while waiting for TCP connection close", ex);
        }
    }

    private static void assertTextResponse(ScpiTransportResponse response, String expected) {
        assertThat(response)
                .isInstanceOfSatisfying(
                        ScpiTransportResponse.Text.class,
                        text -> assertThat(text.rawResponse()).isEqualTo(expected));
    }

    private static void withService(Path devicesFile, ServiceAssertions assertions) {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(
                        ConnectionAutoConfiguration.class,
                        TransportAutoConfiguration.class))
                .withPropertyValues(
                        "psu.connection.devices.file=" + devicesFile,
                        "psu.transport.usb.platform=" + JSerialCommTestPlatformResolver.resolve())
                .run(context ->
                        assertions.verify(context.getBean(ConnectionManagementService.class)));
    }

    @FunctionalInterface
    private interface ServiceAssertions {
        void verify(ConnectionManagementService service);
    }
}
