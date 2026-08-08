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

import org.junit.jupiter.api.Test;

class JSerialCommNativeLayoutTest {

    @Test
    void resolvesWindowsLayoutFromConfiguredPlatform() {
        String previousOsName = System.getProperty("os.name");
        try {
            System.setProperty("os.name", "Windows 11");

            JSerialCommNativeLayout layout = JSerialCommNativeLayout.resolve("x86_64");

            assertThat(layout).isNotNull();
            assertThat(layout.osDirectory()).isEqualTo("Windows");
            assertThat(layout.platformDirectory()).isEqualTo("x86_64");
            assertThat(layout.libraryFileName()).isEqualTo("jSerialComm.dll");
            assertThat(layout.resourcePath()).isEqualTo("/Windows/x86_64/jSerialComm.dll");
        } finally {
            restoreProperty("os.name", previousOsName);
        }
    }

    @Test
    void returnsNullWhenPlatformIsBlank() {
        assertThat(JSerialCommNativeLayout.resolve("  ")).isNull();
    }

    private static void restoreProperty(String key, String value) {
        if (value == null) {
            System.clearProperty(key);
            return;
        }
        System.setProperty(key, value);
    }
}
