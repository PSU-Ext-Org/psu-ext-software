package com.psuext.proxy.scpi;

/*-
 * #%L
 * PSU-BE Proxy
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

import com.psuext.connection.device.DeviceConnection;
import com.psuext.connection.device.DeviceConnectionPatch;
import com.psuext.connection.device.DeviceConnectionType;
import com.psuext.proxy.test.FakeBackedBridgeFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ScpiBridgeServiceTest {

    @TempDir
    Path tempDir;

    @Test
    void formatsDisconnectedCommandError() {
        ScpiBridgeService service = FakeBackedBridgeFactory.fixedResponseBridge(tempDir.resolve("devices.json"));
        service.addDevice(new DeviceConnection(-1, "PSU1", DeviceConnectionType.TCP, "127.0.0.1", "5025", null));

        assertThat(service.send("PSU1", "*IDN?")).isEqualTo("ERR DISCONNECTED Device is not connected: PSU1");
    }

    @Test
    void formatsConnectDisconnectStatusAndRawResponses() {
        ScpiBridgeService service = FakeBackedBridgeFactory.fixedResponseBridge(tempDir.resolve("devices.json"));
        service.addDevice(new DeviceConnection(-1, "PSU1", DeviceConnectionType.TCP, "127.0.0.1", "5025", null));

        assertThat(service.connect("PSU1")).isEqualTo("OK CONNECTED transport=fake host=127.0.0.1 port=5025");
        assertThat(service.status("PSU1"))
                .isEqualTo("STATUS id=0 name=PSU1 state=CONNECTED transport=tcp host=127.0.0.1 port=5025");
        assertThat(service.send("PSU1", "MEAS:VOLT?")).isEqualTo("12.34");
        assertThat(service.disconnect("0")).isEqualTo("OK DISCONNECTED");
    }

    @Test
    void listsModifiesAndDeletesDevices() {
        ScpiBridgeService service = FakeBackedBridgeFactory.fixedResponseBridge(tempDir.resolve("devices.json"));

        assertThat(service.addDevice(new DeviceConnection(
                -1,
                "PSU1",
                DeviceConnectionType.TCP,
                "127.0.0.1",
                "5025",
                null)))
                .isEqualTo("OK DEVICE_ADDED 0,PSU1,TCP,127.0.0.1,5025,");
        assertThat(service.listDevices()).isEqualTo("0,PSU1,TCP,127.0.0.1,5025,");
        assertThat(service.modifyDevice("PSU1", new DeviceConnectionPatch("PSU2", null, "127.0.0.2", null, null)))
                .isEqualTo("OK DEVICE_MODIFIED 0,PSU2,TCP,127.0.0.2,5025,");
        assertThat(service.deleteDevice("PSU2")).isEqualTo("OK DEVICE_DELETED 0,PSU2,TCP,127.0.0.2,5025,");
    }

    @Test
    void usbConnectUsesStoredPortAndFormatsUsbStatus() {
        ScpiBridgeService service = FakeBackedBridgeFactory.fixedResponseBridge(tempDir.resolve("devices.json"));
        service.addDevice(new DeviceConnection(-1, "USB1", DeviceConnectionType.USB, null, "COM3", 115200));

        assertThat(service.connect("USB1")).isEqualTo("OK CONNECTED transport=fake port=COM3 baudrate=115200");
        assertThat(service.status("USB1"))
                .isEqualTo("STATUS id=0 name=USB1 state=CONNECTED transport=usb port=COM3 baudrate=115200");
    }
}
