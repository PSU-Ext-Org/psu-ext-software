package com.psuext.script.execution.scpi;

/*-
 * #%L
 * PSU-BE Script Runner
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
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Path;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import com.psuext.connection.ConnectionAutoConfiguration;
import com.psuext.connection.device.DeviceConnection;
import com.psuext.connection.device.DeviceConnectionType;
import com.psuext.connection.service.ConnectionManagementService;
import com.psuext.script.test.logging.LogCapture;
import com.psuext.test.scpi.FakeScpiTcpServer;
import com.psuext.transport.TransportAutoConfiguration;
import com.psuext.transport.core.model.ScpiTransportResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class ConnectionManagementScriptScpiGatewayTest {

    private static final String DEVICE = "PSU1";

    @TempDir
    private Path temporaryDirectory;

    @Test
    void textQueryReturnsRawText() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start().respondTo("*IDN?", "PSU-EXT")) {
            runConnected(server, (gateway, service) ->
                    assertThat(gateway.queryText(DEVICE, "*IDN?")).isEqualTo("PSU-EXT"));
        }
    }

    @Test
    void writeAcceptsControlSuccess() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start()) {
            runConnected(server, (gateway, service) -> {
                gateway.write(DEVICE, "OUTP ON");

                assertThat(server.commandObserved()).isTrue();
                assertThat(server.commands()).containsExactly("OUTP ON");
            });
        }
    }

    @Test
    void disconnectedResponseMapsToException() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start()) {
            runWithService(server, (gateway, service) -> {
                service.addDevice(device(server.port()));

                try (LogCapture logs = LogCapture.forClass(ConnectionManagementScriptScpiGateway.class)) {
                    assertThatExceptionOfType(ScriptScpiException.class)
                            .isThrownBy(() -> gateway.queryText(DEVICE, "*IDN?"))
                            .satisfies(error -> assertCode(error, "DISCONNECTED"));
                    assertThat(logs.messages()).anyMatch(message -> message.contains("errorCode=DISCONNECTED"));
                    assertThat(logs.messages()).noneMatch(message -> message.contains("Device is not connected"));
                }
            });
        }
    }

    @Test
    void timeoutResponseMapsToException() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start()) {
            runConnected(server, (gateway, service) ->
                    assertThatExceptionOfType(ScriptScpiException.class)
                            .isThrownBy(() -> gateway.queryText(DEVICE, "SLOW?"))
                            .satisfies(error -> assertCode(error, "TIMEOUT")));
        }
    }

    @Test
    void binaryQueryReturnsPsuMeasurementDataBlockUnchanged() throws Exception {
        byte[] binaryBlock = new byte[] {
                '#', '2', '2', '4',
                (byte) 0xE8, 0x03, 0x00, 0x00, (byte) 0xC0, (byte) 0xD4, 0x01, 0x00,
                0x4C, 0x04, 0x00, 0x00, 0x3D, (byte) 0xD5, 0x01, 0x00,
                (byte) 0xB0, 0x04, 0x00, 0x00, (byte) 0xAC, (byte) 0xD4, 0x01, 0x00

        };
        try (
                FakeScpiTcpServer server = FakeScpiTcpServer.start()
                        .respondBinaryTo("MEAS:VOLT:DATA? CH1", binaryBlock)
        ) {
            runConnected(server, (gateway, service) -> {
                byte[] result = gateway.queryBinary(DEVICE, "MEAS:VOLT:DATA? CH1");

                assertThat(result).containsExactly(binaryBlock);
                assertThat(result).startsWith((byte) '#', (byte) '2', (byte) '2', (byte) '4');

                ByteBuffer payload = ByteBuffer.wrap(result, 4, 24).order(ByteOrder.LITTLE_ENDIAN);
                assertThat(payload.getInt()).isEqualTo(1_000);
                assertThat(payload.getInt()).isEqualTo(120_000);
                assertThat(payload.getInt()).isEqualTo(1_100);
                assertThat(payload.getInt()).isEqualTo(120_125);
                assertThat(payload.getInt()).isEqualTo(1_200);
                assertThat(payload.getInt()).isEqualTo(119_980);
            });
        }
    }

    @Test
    void binaryQueryRejectsTextResponse() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start().respondTo("DATA?", "not binary")) {
            runConnected(server, (gateway, service) ->
                    assertThatExceptionOfType(ScriptScpiException.class)
                            .isThrownBy(() -> gateway.queryBinary(DEVICE, "DATA?"))
                            .satisfies(error -> assertCode(error, "UNEXPECTED_TEXT_RESPONSE")));
        }
    }

    @Test
    void deviceConnectionExceptionPreservesCode() {
        runWithService(5025, "missing-devices.json", (gateway, service) ->
                assertThatExceptionOfType(ScriptScpiException.class)
                        .isThrownBy(() -> gateway.queryText("MISSING", "*IDN?"))
                        .satisfies(error -> assertCode(error, "DEVICE_NOT_FOUND")));
    }

    @Test
    void deviceExistsMatchesIdOrName() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start()) {
            runWithService(server, (gateway, service) -> {
                service.addDevice(device(server.port()));

                assertThat(gateway.deviceExists("0")).isTrue();
                assertThat(gateway.deviceExists("psu1")).isTrue();
                assertThat(gateway.deviceExists("missing")).isFalse();
            });
        }
    }

    @Test
    void sendReturnsRawTransportResponse() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start().respondTo("*IDN?", "OK")) {
            runConnected(server, (gateway, service) ->
                    assertThat(gateway.send(DEVICE, "*IDN?"))
                            .isInstanceOfSatisfying(
                                    ScpiTransportResponse.Text.class,
                                    text -> assertThat(text.rawResponse()).isEqualTo("OK")));
        }
    }

    private void runConnected(FakeScpiTcpServer server, GatewayScenario scenario) {
        runWithService(server, (ignoredGateway, service) -> {
            service.addDevice(device(server.port()));
            ScriptDeviceSessionCoordinator coordinator = gatewayCoordinator(service);
            assertThat(coordinator.connect(DEVICE).ok()).isTrue();
            scenario.run(new ConnectionManagementScriptScpiGateway(coordinator), service);
        });
    }

    @Test
    void timeoutResetsAndReconnectsBeforeTheNextQueuedQuery() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start().withoutResponse("SLOW?")) {
            runWithService(server, (ignoredGateway, service) -> {
                service.addDevice(device(server.port()));
                ScriptDeviceSessionCoordinator coordinator = gatewayCoordinator(service);
                ConnectionManagementScriptScpiGateway gateway = new ConnectionManagementScriptScpiGateway(coordinator);
                assertThat(coordinator.connect(DEVICE).ok()).isTrue();

                assertThatExceptionOfType(ScriptScpiException.class)
                        .isThrownBy(() -> gateway.queryText(DEVICE, "SLOW?"))
                        .satisfies(error -> assertCode(error, "TIMEOUT"));

                server.respondTo("FAST?", "fresh-response");
                assertThat(gateway.queryText("0", "FAST?")).isEqualTo("fresh-response");
                assertThat(server.acceptCount()).isGreaterThanOrEqualTo(2);
                assertThat(server.commands()).containsExactly("SLOW?", "FAST?");
            });
        }
    }

    @Test
    void deviceErrorResetsAndReconnectsBeforeTheNextQueuedQuery() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start().respondTo("BAD?", "ERR,\"bad command\"")) {
            runWithService(server, (ignoredGateway, service) -> {
                service.addDevice(device(server.port()));
                ScriptDeviceSessionCoordinator coordinator = gatewayCoordinator(service);
                ConnectionManagementScriptScpiGateway gateway = new ConnectionManagementScriptScpiGateway(coordinator);
                assertThat(coordinator.connect(DEVICE).ok()).isTrue();

                assertThatExceptionOfType(ScriptScpiException.class)
                        .isThrownBy(() -> gateway.queryText(DEVICE, "BAD?"))
                        .satisfies(error -> assertCode(error, "SCPI_ERROR"));

                server.respondTo("FAST?", "fresh-response");
                assertThat(gateway.queryText(DEVICE, "FAST?")).isEqualTo("fresh-response");
                assertThat(server.acceptCount()).isGreaterThanOrEqualTo(2);
                assertThat(server.commands()).containsExactly("BAD?", "FAST?");
            });
        }
    }

    @Test
    void concurrentIdAndNameQueriesShareTheSameDeviceSession() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start()
                .respondTo("ONE?", "one")
                .respondTo("TWO?", "two")) {
            runWithService(server, (ignoredGateway, service) -> {
                service.addDevice(device(server.port()));
                ScriptDeviceSessionCoordinator coordinator = gatewayCoordinator(service);
                ConnectionManagementScriptScpiGateway gateway = new ConnectionManagementScriptScpiGateway(coordinator);
                assertThat(coordinator.connect(DEVICE).ok()).isTrue();

                //noinspection resource -- ExecutorService is not AutoCloseable at this source level; shut down below.
                ExecutorService callers = Executors.newFixedThreadPool(2);
                try {
                    Future<String> first = callers.submit(() -> gateway.queryText("0", "ONE?"));
                    Future<String> second = callers.submit(() -> gateway.queryText(DEVICE, "TWO?"));

                    assertThat(first.get()).isEqualTo("one");
                    assertThat(second.get()).isEqualTo("two");
                } finally {
                    callers.shutdownNow();
                }
                assertThat(server.commands()).containsExactlyInAnyOrder("ONE?", "TWO?");
            });
        }
    }

    private static DeviceConnection device(int port) {
        return new DeviceConnection(-1, DEVICE, DeviceConnectionType.TCP, "127.0.0.1", String.valueOf(port), null);
    }

    private void runWithService(FakeScpiTcpServer server, GatewayScenario scenario) {
        runWithService(server.port(), "devices-" + server.port() + ".json", scenario);
    }

    private void runWithService(int port, String deviceFileName, GatewayScenario scenario) {
        Path deviceFile = temporaryDirectory.resolve(deviceFileName);
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(
                        TransportAutoConfiguration.class,
                        ConnectionAutoConfiguration.class))
                .withPropertyValues(
                        "psu.connection.devices.file=" + deviceFile,
                        "psu.transport.tcp.host=127.0.0.1",
                        "psu.transport.tcp.port=" + port,
                        "psu.transport.tcp.connect-timeout=1s",
                        "psu.transport.tcp.read-timeout=200ms",
                        "psu.transport.tcp.command-timeout=200ms",
                        "psu.transport.tcp.timeout-disconnect-threshold=3")
                .run(context -> {
                    ConnectionManagementService service = context.getBean(ConnectionManagementService.class);
                    ScriptDeviceSessionCoordinator coordinator = gatewayCoordinator(service);
                    ConnectionManagementScriptScpiGateway gateway = new ConnectionManagementScriptScpiGateway(coordinator);
                    scenario.run(gateway, service);
                });
    }

    private static ScriptDeviceSessionCoordinator gatewayCoordinator(ConnectionManagementService service) {
        return new ScriptDeviceSessionCoordinator(service);
    }

    private static void assertCode(Throwable error, String code) {
        ScriptScpiException scpiException = (ScriptScpiException) error;
        assertThat(scpiException.code()).isEqualTo(code);
    }

    @FunctionalInterface
    private interface GatewayScenario {

        void run(ConnectionManagementScriptScpiGateway gateway, ConnectionManagementService service) throws Exception;
    }
}
