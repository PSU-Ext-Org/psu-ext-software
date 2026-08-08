package com.psuext.transport.config;

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

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Binds shared transport configuration from {@code psu.transport.*}.
 */
@ConfigurationProperties(prefix = "psu.transport")
public class TransportProperties {

    private Tcp tcp = new Tcp();
    private Usb usb = new Usb();

    /**
     * Returns TCP transport defaults.
     *
     * @return TCP transport settings
     */
    public Tcp tcp() {
        return tcp;
    }

    /**
     * JavaBean getter for TCP transport defaults.
     *
     * @return TCP transport settings
     */
    public Tcp getTcp() {
        return tcp;
    }

    /**
     * Sets TCP transport defaults.
     *
     * @param tcp TCP transport settings
     */
    public void setTcp(Tcp tcp) {
        this.tcp = tcp == null ? new Tcp() : tcp;
    }

    /**
     * Returns USB transport defaults.
     *
     * @return USB transport settings
     */
    public Usb usb() {
        return usb;
    }

    /**
     * JavaBean getter for USB transport defaults.
     *
     * @return USB transport settings
     */
    public Usb getUsb() {
        return usb;
    }

    /**
     * Sets USB transport defaults.
     *
     * @param usb USB transport settings
     */
    public void setUsb(Usb usb) {
        this.usb = usb == null ? new Usb() : usb;
    }

    /**
     * TCP SCPI transport configuration.
     */
    public static class Tcp {
        private String host = "192.168.4.1";
        private Integer port = 5025;
        private Duration connectTimeout = Duration.ofSeconds(2);
        private Duration readTimeout = Duration.ofSeconds(1);
        private Duration commandTimeout = Duration.ofSeconds(2);
        private Integer timeoutDisconnectThreshold = 3;
        private String lineEnding = "\n";
        private String responseDelimiter = "\n";

        /**
         * Creates TCP settings with defaults.
         */
        public Tcp() {
        }

        /**
         * Creates explicit TCP settings.
         *
         * @param host default TCP host for PSU-EXT SCPI
         * @param port default TCP port for PSU-EXT SCPI
         * @param connectTimeout timeout for opening a TCP connection
         * @param readTimeout socket read timeout used by the TCP client
         * @param commandTimeout request or reply timeout for one SCPI command
         * @param timeoutDisconnectThreshold consecutive command timeouts before marking TCP disconnected
         * @param lineEnding bytes appended to outbound SCPI commands
         * @param responseDelimiter delimiter expected at the end of inbound SCPI replies
         */
        public Tcp(
                String host,
                Integer port,
                Duration connectTimeout,
                Duration readTimeout,
                Duration commandTimeout,
                Integer timeoutDisconnectThreshold,
                String lineEnding,
                String responseDelimiter) {
            this.host = host == null || host.isBlank() ? "192.168.4.1" : host;
            this.port = port == null ? 5025 : port;
            this.connectTimeout = connectTimeout == null ? Duration.ofSeconds(2) : connectTimeout;
            this.readTimeout = readTimeout == null ? Duration.ofSeconds(1) : readTimeout;
            this.commandTimeout = commandTimeout == null ? Duration.ofSeconds(2) : commandTimeout;
            this.timeoutDisconnectThreshold = normalizeTimeoutDisconnectThreshold(timeoutDisconnectThreshold);
            this.lineEnding = lineEnding == null ? "\n" : lineEnding;
            this.responseDelimiter = responseDelimiter == null ? "\n" : responseDelimiter;
        }

        public String host() {
            return host;
        }

        public String getHost() {
            return host;
        }

        public void setHost(String host) {
            this.host = host == null || host.isBlank() ? "192.168.4.1" : host;
        }

        public Integer port() {
            return port;
        }

        public Integer getPort() {
            return port;
        }

        public void setPort(Integer port) {
            this.port = port == null ? 5025 : port;
        }

        public Duration connectTimeout() {
            return connectTimeout;
        }

        public Duration getConnectTimeout() {
            return connectTimeout;
        }

        public void setConnectTimeout(Duration connectTimeout) {
            this.connectTimeout = connectTimeout == null ? Duration.ofSeconds(2) : connectTimeout;
        }

        public Duration readTimeout() {
            return readTimeout;
        }

        public Duration getReadTimeout() {
            return readTimeout;
        }

        public void setReadTimeout(Duration readTimeout) {
            this.readTimeout = readTimeout == null ? Duration.ofSeconds(1) : readTimeout;
        }

        public Duration commandTimeout() {
            return commandTimeout;
        }

        public Duration getCommandTimeout() {
            return commandTimeout;
        }

        public void setCommandTimeout(Duration commandTimeout) {
            this.commandTimeout = commandTimeout == null ? Duration.ofSeconds(2) : commandTimeout;
        }

        public Integer timeoutDisconnectThreshold() {
            return timeoutDisconnectThreshold;
        }

        public Integer getTimeoutDisconnectThreshold() {
            return timeoutDisconnectThreshold;
        }

        public void setTimeoutDisconnectThreshold(Integer timeoutDisconnectThreshold) {
            this.timeoutDisconnectThreshold = normalizeTimeoutDisconnectThreshold(timeoutDisconnectThreshold);
        }

        public String lineEnding() {
            return lineEnding;
        }

        public String getLineEnding() {
            return lineEnding;
        }

        public void setLineEnding(String lineEnding) {
            this.lineEnding = lineEnding == null ? "\n" : lineEnding;
        }

        public String responseDelimiter() {
            return responseDelimiter;
        }

        public String getResponseDelimiter() {
            return responseDelimiter;
        }

        public void setResponseDelimiter(String responseDelimiter) {
            this.responseDelimiter = responseDelimiter == null ? "\n" : responseDelimiter;
        }

        private Integer normalizeTimeoutDisconnectThreshold(Integer threshold) {
            return threshold == null || threshold < 1 ? 3 : threshold;
        }
    }

    /**
     * USB CDC serial SCPI transport configuration.
     */
    public static class Usb {
        private String platform;
        private Duration readTimeout = Duration.ofSeconds(1);
        private Duration commandTimeout = Duration.ofSeconds(2);
        private Duration writeResponseTimeout = Duration.ofMillis(50);
        private Integer timeoutDisconnectThreshold = 3;
        private String lineEnding = "\n";
        private String responseDelimiter = "\n";

        /**
         * Creates USB settings with defaults.
         */
        public Usb() {
        }

        /**
         * Creates explicit USB settings.
         *
         * @param platform optional bundled native-platform override, such as {@code x86_64}
         * @param readTimeout serial read timeout used by the USB client
         * @param commandTimeout request or reply timeout for one SCPI command
         * @param timeoutDisconnectThreshold consecutive command timeouts before marking USB disconnected
         * @param lineEnding bytes appended to outbound SCPI commands
         * @param responseDelimiter delimiter expected at the end of inbound SCPI replies
         */
        public Usb(
                String platform,
                Duration readTimeout,
                Duration commandTimeout,
                Integer timeoutDisconnectThreshold,
                String lineEnding,
                String responseDelimiter) {
            this.platform = normalizePlatform(platform);
            this.readTimeout = readTimeout == null ? Duration.ofSeconds(1) : readTimeout;
            this.commandTimeout = commandTimeout == null ? Duration.ofSeconds(2) : commandTimeout;
            this.timeoutDisconnectThreshold = normalizeTimeoutDisconnectThreshold(timeoutDisconnectThreshold);
            this.lineEnding = lineEnding == null ? "\n" : lineEnding;
            this.responseDelimiter = responseDelimiter == null ? "\n" : responseDelimiter;
        }

        public String platform() {
            return platform;
        }

        public String getPlatform() {
            return platform;
        }

        public void setPlatform(String platform) {
            this.platform = normalizePlatform(platform);
        }

        public Duration readTimeout() {
            return readTimeout;
        }

        public Duration getReadTimeout() {
            return readTimeout;
        }

        public void setReadTimeout(Duration readTimeout) {
            this.readTimeout = readTimeout == null ? Duration.ofSeconds(1) : readTimeout;
        }

        public Duration commandTimeout() {
            return commandTimeout;
        }

        public Duration getCommandTimeout() {
            return commandTimeout;
        }

        public void setCommandTimeout(Duration commandTimeout) {
            this.commandTimeout = commandTimeout == null ? Duration.ofSeconds(2) : commandTimeout;
        }

        /**
         * Returns how long a non-query USB command waits for an unexpected
         * response before it is considered successfully silent.
         */
        public Duration writeResponseTimeout() {
            return writeResponseTimeout;
        }

        public Duration getWriteResponseTimeout() {
            return writeResponseTimeout;
        }

        public void setWriteResponseTimeout(Duration writeResponseTimeout) {
            this.writeResponseTimeout = writeResponseTimeout == null
                    ? Duration.ofMillis(50)
                    : writeResponseTimeout;
        }

        public Integer timeoutDisconnectThreshold() {
            return timeoutDisconnectThreshold;
        }

        public Integer getTimeoutDisconnectThreshold() {
            return timeoutDisconnectThreshold;
        }

        public void setTimeoutDisconnectThreshold(Integer timeoutDisconnectThreshold) {
            this.timeoutDisconnectThreshold = normalizeTimeoutDisconnectThreshold(timeoutDisconnectThreshold);
        }

        public String lineEnding() {
            return lineEnding;
        }

        public String getLineEnding() {
            return lineEnding;
        }

        public void setLineEnding(String lineEnding) {
            this.lineEnding = lineEnding == null ? "\n" : lineEnding;
        }

        public String responseDelimiter() {
            return responseDelimiter;
        }

        public String getResponseDelimiter() {
            return responseDelimiter;
        }

        public void setResponseDelimiter(String responseDelimiter) {
            this.responseDelimiter = responseDelimiter == null ? "\n" : responseDelimiter;
        }

        private Integer normalizeTimeoutDisconnectThreshold(Integer threshold) {
            return threshold == null || threshold < 1 ? 3 : threshold;
        }

        private String normalizePlatform(String platform) {
            if (platform == null || platform.isBlank()) {
                return null;
            }
            return platform.trim();
        }
    }
}


