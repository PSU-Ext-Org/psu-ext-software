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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Path;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.psuext.connection.device.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class JsonDeviceConnectionDaoTest {

    @TempDir
    Path tempDir;

    @Test
    void createsMissingFileAndPersistsDevices() {
        Path file = tempDir.resolve("devices.json");
        JsonDeviceConnectionDao dao = dao(file);

        DeviceConnection stored = dao.add(new DeviceConnection(
                -1,
                "PSU1",
                DeviceConnectionType.TCP,
                "127.0.0.1",
                "5025",
                null));

        assertThat(stored.id()).isZero();
        assertThat(file).exists();
        assertThat(dao(file).list()).containsExactly(stored);
    }

    @Test
    void modifiesDeletesAndReusesSmallestFreeId() {
        JsonDeviceConnectionDao dao = dao(tempDir.resolve("devices.json"));
        DeviceConnection first = dao.add(new DeviceConnection(
                -1,
                "PSU1",
                DeviceConnectionType.TCP,
                "127.0.0.1",
                "5025",
                null));
        DeviceConnection second = dao.add(new DeviceConnection(
                -1,
                "USB1",
                DeviceConnectionType.USB,
                null,
                "COM3",
                115200));

        DeviceConnection modified = dao.modify("USB1", new DeviceConnectionPatch("USB2", null, null, "COM4", 9600));
        DeviceConnection deleted = dao.delete(String.valueOf(first.id()));
        DeviceConnection reused = dao.add(new DeviceConnection(
                -1,
                "PSU2",
                DeviceConnectionType.TCP,
                "127.0.0.2",
                "5026",
                null));

        assertThat(second.id()).isEqualTo(1);
        assertThat(modified.name()).isEqualTo("USB2");
        assertThat(modified.port()).isEqualTo("COM4");
        assertThat(deleted.name()).isEqualTo("PSU1");
        assertThat(reused.id()).isZero();
    }

    @Test
    void rejectsInvalidNamesDuplicatesAndMissingTypeFields() {
        JsonDeviceConnectionDao dao = dao(tempDir.resolve("devices.json"));
        dao.add(new DeviceConnection(-1, "PSU1", DeviceConnectionType.TCP, "127.0.0.1", "5025", null));

        assertThatThrownBy(() -> dao.add(new DeviceConnection(
                -1,
                "psu-one",
                DeviceConnectionType.TCP,
                "127.0.0.1",
                "5025",
                null)))
                .isInstanceOf(DeviceConnectionException.class)
                .hasMessageContaining("[A-Z0-9]{1,8}");
        assertThatThrownBy(() -> dao.add(new DeviceConnection(
                -1,
                "PSU1",
                DeviceConnectionType.TCP,
                "127.0.0.2",
                "5025",
                null)))
                .isInstanceOf(DeviceConnectionException.class)
                .hasMessageContaining("already exists");
        assertThatThrownBy(() -> dao.add(new DeviceConnection(
                -1,
                "TCP2",
                DeviceConnectionType.TCP,
                null,
                "5025",
                null)))
                .isInstanceOf(DeviceConnectionException.class)
                .hasMessageContaining("TCP ip is required");
        assertThatThrownBy(() -> dao.add(new DeviceConnection(
                -1,
                "USB1",
                DeviceConnectionType.USB,
                null,
                "COM3",
                null)))
                .isInstanceOf(DeviceConnectionException.class)
                .hasMessageContaining("USB baudrate");
    }

    @Test
    void rejectsDuplicateTcpIpPortEvenWithDifferentIdAndName() {
        JsonDeviceConnectionDao dao = dao(tempDir.resolve("devices.json"));
        dao.add(new DeviceConnection(-1, "PSU1", DeviceConnectionType.TCP, "127.0.0.1", "5025", null));
        dao.add(new DeviceConnection(-1, "PSU2", DeviceConnectionType.TCP, "127.0.0.2", "5026", null));

        assertThatThrownBy(() -> dao.add(new DeviceConnection(
                -1,
                "PSU3",
                DeviceConnectionType.TCP,
                "127.0.0.1",
                "5025",
                null)))
                .isInstanceOf(DeviceConnectionException.class)
                .hasMessageContaining("TCP device target already exists");
        assertThatThrownBy(() -> dao.modify("PSU2", new DeviceConnectionPatch(null, null, "127.0.0.1", "5025", null)))
                .isInstanceOf(DeviceConnectionException.class)
                .hasMessageContaining("TCP device target already exists");
    }

    @Test
    void rejectsDuplicateUsbPortEvenWithDifferentIdAndName() {
        JsonDeviceConnectionDao dao = dao(tempDir.resolve("devices.json"));
        dao.add(new DeviceConnection(-1, "USB1", DeviceConnectionType.USB, null, "COM3", 115200));
        dao.add(new DeviceConnection(-1, "USB2", DeviceConnectionType.USB, null, "COM4", 115200));

        assertThatThrownBy(() -> dao.add(new DeviceConnection(
                -1,
                "USB3",
                DeviceConnectionType.USB,
                null,
                "COM3",
                9600)))
                .isInstanceOf(DeviceConnectionException.class)
                .hasMessageContaining("USB device port already exists");
        assertThatThrownBy(() -> dao.modify("USB2", new DeviceConnectionPatch(null, null, null, "COM3", null)))
                .isInstanceOf(DeviceConnectionException.class)
                .hasMessageContaining("USB device port already exists");
    }

    @Test
    void rejectsRegistryFullAfterAllIdsAreUsed() {
        JsonDeviceConnectionDao dao = dao(tempDir.resolve("devices.json"));
        for (int id = 0; id <= 255; id++) {
            dao.add(new DeviceConnection(
                    -1,
                    "D" + id,
                    DeviceConnectionType.TCP,
                    "127.0.0.1",
                    String.valueOf(1024 + id),
                    null));
        }

        assertThatThrownBy(() -> dao.add(new DeviceConnection(
                -1,
                "FULL",
                DeviceConnectionType.TCP,
                "127.0.0.1",
                "5025",
                null)))
                .isInstanceOf(DeviceConnectionException.class)
                .hasMessageContaining("No free device id");
    }

    private JsonDeviceConnectionDao dao(Path file) {
        return new JsonDeviceConnectionDao(new ObjectMapper().findAndRegisterModules(), file);
    }
}
