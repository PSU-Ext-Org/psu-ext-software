package com.psuext.test.usb;

/*-
 * #%L
 * PSU-BE Test Support
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

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Resolves the bundled jSerialComm platform directory for backend tests.
 *
 * <p>The {@value #PLATFORM_PROPERTY} JVM property overrides automatic
 * resolution when a test runs on an unsupported or unusual architecture.
 */
public final class JSerialCommTestPlatformResolver {

    private static final Logger LOGGER = LoggerFactory.getLogger(JSerialCommTestPlatformResolver.class);

    /** JVM property that overrides the resolved jSerialComm platform directory. */
    public static final String PLATFORM_PROPERTY = "psu.test.usb.platform";

    private JSerialCommTestPlatformResolver() {
    }

    /**
     * Resolves the jSerialComm platform directory for the current JVM.
     *
     * @return bundled jSerialComm platform directory
     * @throws IllegalStateException when the architecture is not supported and
     *                               no explicit platform override is provided
     */
    public static String resolve() {
        String configuredPlatform = System.getProperty(PLATFORM_PROPERTY);
        if (configuredPlatform != null && !configuredPlatform.isBlank()) {
            return logResolution(configuredPlatform, "JVM property");
        }

        String osName = System.getProperty("os.name", "").toLowerCase(Locale.ROOT);
        String architecture = System.getProperty("os.arch", "").toLowerCase(Locale.ROOT);
        String resolvedPlatform = switch (architecture) {
            case "amd64", "x86_64" -> "x86_64";
            case "x86", "i386", "i486", "i586", "i686" -> "x86";
            case "aarch64", "arm64" -> osName.contains("linux") ? "armv8_64" : "aarch64";
            case "arm", "arm32" -> osName.contains("linux") ? "armv7hf" : "armv7";
            default -> throw new IllegalStateException(
                    "Set -D" + PLATFORM_PROPERTY + " for unsupported test architecture: " + architecture);
        };
        return logResolution(resolvedPlatform, "current JVM");
    }

    private static String logResolution(String platform, String source) {
        LOGGER.info("Resolved jSerialComm test platform: platform={} source={}", platform, source);
        return platform;
    }
}
