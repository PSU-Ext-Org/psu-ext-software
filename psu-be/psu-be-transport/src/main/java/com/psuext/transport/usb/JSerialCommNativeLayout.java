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

import java.util.Locale;

/**
 * Resolves the bundled jSerialComm native resource layout for the current OS.
 *
 * <p>The platform subdirectory comes directly from configuration. OS-specific
 * directory names and library filenames are defined here so staging logic does
 * not need to know them.
 */
final class JSerialCommNativeLayout {

    private final NativeOs os;
    private final String platformDirectory;

    private JSerialCommNativeLayout(NativeOs os, String platformDirectory) {
        this.os = os;
        this.platformDirectory = platformDirectory;
    }

    static JSerialCommNativeLayout resolve(String platform) {
        if (platform == null || platform.isBlank()) {
            return null;
        }

        NativeOs os = NativeOs.detect(System.getProperty("os.name", ""));
        return os == null ? null : new JSerialCommNativeLayout(os, platform.trim());
    }

    String osDirectory() {
        return os.directoryName();
    }

    String platformDirectory() {
        return platformDirectory;
    }

    String libraryFileName() {
        return os.libraryFileName();
    }

    String resourcePath() {
        return "/" + osDirectory() + "/" + platformDirectory() + "/" + libraryFileName();
    }

    private enum NativeOs {
        WINDOWS("win", "Windows", "jSerialComm.dll"),
        MAC("mac", "OSX", "libjSerialComm.jnilib"),
        LINUX("nix", "Linux", "libjSerialComm.so"),
        LINUX_ALT("nux", "Linux", "libjSerialComm.so");

        private final String matchToken;
        private final String directoryName;
        private final String libraryFileName;

        NativeOs(String matchToken, String directoryName, String libraryFileName) {
            this.matchToken = matchToken;
            this.directoryName = directoryName;
            this.libraryFileName = libraryFileName;
        }

        static NativeOs detect(String osName) {
            String normalizedOsName = osName == null ? "" : osName.toLowerCase(Locale.ROOT);
            for (NativeOs candidate : values()) {
                if (normalizedOsName.contains(candidate.matchToken)) {
                    return candidate;
                }
            }
            return null;
        }

        String directoryName() {
            return directoryName;
        }

        String libraryFileName() {
            return libraryFileName;
        }
    }
}
