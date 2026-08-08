package com.psuext.transport.usb;

/*-
 * #%L
 * PSU-BE Transport
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

import java.nio.file.Files;
import java.nio.file.Path;

import com.psuext.transport.config.TransportProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class JSerialCommNativeLibraryConfigurerTest {

    @TempDir
    Path tempDir;

    @Test
    void doesNothingWhenPlatformIsNotConfigured() throws Exception {
        String previousLibraryPath = System.getProperty("jSerialComm.library.path");
        String previousTmpDir = System.getProperty("java.io.tmpdir");
        String previousOsName = System.getProperty("os.name");
        try {
            System.clearProperty("jSerialComm.library.path");
            System.setProperty("java.io.tmpdir", tempDir.toString());
            System.setProperty("os.name", "Windows 11");

            JSerialCommNativeLibraryConfigurer.ensureConfigured(new TransportProperties.Usb());

            assertThat(System.getProperty("jSerialComm.library.path")).isNull();
        } finally {
            restoreProperty("jSerialComm.library.path", previousLibraryPath);
            restoreProperty("java.io.tmpdir", previousTmpDir);
            restoreProperty("os.name", previousOsName);
        }
    }

    @Test
    void usesConfiguredPlatformWhenProvided() throws Exception {
        String previousLibraryPath = System.getProperty("jSerialComm.library.path");
        String previousTmpDir = System.getProperty("java.io.tmpdir");
        String previousOsName = System.getProperty("os.name");
        try {
            System.clearProperty("jSerialComm.library.path");
            System.setProperty("java.io.tmpdir", tempDir.toString());
            System.setProperty("os.name", "Windows 11");

            JSerialCommNativeLibraryConfigurer.ensureConfigured(new TransportProperties.Usb(
                    "x86_64",
                    null,
                    null,
                    null,
                    null,
                    null));

            Path root = tempDir.resolve("psu-ext-jserialcomm").resolve("2.11.0");
            Path dll = root.resolve("Windows").resolve("x86_64").resolve("jSerialComm.dll");
            assertThat(System.getProperty("jSerialComm.library.path")).isEqualTo(root.toString());
            assertThat(Files.exists(dll)).isTrue();
            assertThat(Files.size(dll)).isEqualTo(210_432L);
        } finally {
            restoreProperty("jSerialComm.library.path", previousLibraryPath);
            restoreProperty("java.io.tmpdir", previousTmpDir);
            restoreProperty("os.name", previousOsName);
        }
    }

    private static void restoreProperty(String key, String value) {
        if (value == null) {
            System.clearProperty(key);
            return;
        }
        System.setProperty(key, value);
    }
}
