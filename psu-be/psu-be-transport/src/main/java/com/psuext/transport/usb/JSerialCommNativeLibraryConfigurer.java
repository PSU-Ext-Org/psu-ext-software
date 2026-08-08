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

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

import com.psuext.transport.config.TransportProperties;

/**
 * Prepares a deterministic native-library search path for jSerialComm.
 *
 * <p>This avoids platform-selection failures where jSerialComm extracts an
 * incorrect native binary before reaching the matching Windows x86_64 entry.
 */
final class JSerialCommNativeLibraryConfigurer {

    private static final String LIBRARY_PATH_PROPERTY = "jSerialComm.library.path";
    private static final String VERSION = "2.11.0";

    private JSerialCommNativeLibraryConfigurer() {
    }

    /**
     * Ensures jSerialComm will search a pre-staged native library tree before
     * attempting its built-in extraction fallback.
     */
    static synchronized void ensureConfigured(TransportProperties.Usb properties) {
        String configuredPath = System.getProperty(LIBRARY_PATH_PROPERTY, "");
        if (configuredPath != null && !configuredPath.isBlank()) {
            return;
        }

        JSerialCommNativeLayout layout =
                JSerialCommNativeLayout.resolve(properties == null ? null : properties.platform());
        if (layout == null) {
            return;
        }

        Path root = Path.of(System.getProperty("java.io.tmpdir"), "psu-ext-jserialcomm", VERSION);
        Path target = root.resolve(layout.osDirectory())
                .resolve(layout.platformDirectory())
                .resolve(layout.libraryFileName());
        try {
            if (!Files.exists(target)) {
                Files.createDirectories(target.getParent());
                try (InputStream inputStream
                             = JSerialCommNativeLibraryConfigurer.class.getResourceAsStream(layout.resourcePath())) {
                    if (inputStream == null) {
                        throw new IllegalStateException("Missing jSerialComm native resource " + layout.resourcePath());
                    }
                    Files.copy(inputStream, target, StandardCopyOption.REPLACE_EXISTING);
                }
            }
            System.setProperty(LIBRARY_PATH_PROPERTY, root.toString());
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to prepare jSerialComm native library path", ex);
        }
    }
}
