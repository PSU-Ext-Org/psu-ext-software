package com.psuext.connection.config;

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

import java.nio.file.Path;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Binds shared connection-management configuration from {@code psu.connection.*}.
 */
@ConfigurationProperties(prefix = "psu.connection")
public class ConnectionProperties {

    private Devices devices = new Devices();

    /**
     * Returns device registry settings.
     *
     * @return device registry settings
     */
    public Devices devices() {
        return devices;
    }

    /**
     * JavaBean getter for device registry settings.
     *
     * @return device registry settings
     */
    public Devices getDevices() {
        return devices;
    }

    /**
     * Sets device registry settings.
     *
     * @param devices device registry settings
     */
    public void setDevices(Devices devices) {
        this.devices = devices == null ? new Devices() : devices;
    }

    /**
     * Device registry persistence configuration.
     */
    public static class Devices {
        private Path file = Path.of("devices.json");

        /**
         * Returns the JSON file used to persist configured device connections.
         *
         * @return JSON registry file path
         */
        public Path file() {
            return file;
        }

        public Path getFile() {
            return file;
        }

        /**
         * Sets the JSON file used to persist configured device connections.
         *
         * @param file JSON registry file path
         */
        public void setFile(Path file) {
            this.file = file == null ? Path.of("devices.json") : file;
        }
    }
}


