package com.psuext.proxy.it;

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

import java.net.URI;
import java.time.Duration;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import org.jspecify.annotations.NullMarked;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * Manual integration test for a real PSU-EXT SCPI TCP server.
 *
 * <p>The test is ignored by default and only runs when explicitly enabled with
 * {@code -DPSU_MANUAL_SCPI_IT=true}. It boots the Spring application, connects to
 * the real WebSocket endpoint, ensures a TCP device profile exists, connects
 * it, sends {@code *IDN?}, verifies the response, and disconnects.
 */
@Tag("manual")
@Disabled
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ManualScpiWebSocketIntegrationTest {

    private static final Logger LOGGER = LoggerFactory.getLogger(ManualScpiWebSocketIntegrationTest.class);
    private static final String DEVICE_NAME = "PSU1";
    private static final String DEFAULT_HOST = "192.168.0.94";
    private static final int DEFAULT_PORT = 5025;

    @LocalServerPort
    private int serverPort;

    @Value("${psu.transport.tcp.host}")
    private String scpiHost;

    @Value("${psu.transport.tcp.port}")
    private int scpiPort;

    @DynamicPropertySource
    static void manualScpiProperties(DynamicPropertyRegistry registry) {
        registry.add("psu.transport.tcp.host", () -> setting("PSU_MANUAL_SCPI_HOST", DEFAULT_HOST));
        registry.add("psu.transport.tcp.port", () -> setting("PSU_MANUAL_SCPI_PORT", String.valueOf(DEFAULT_PORT)));
        registry.add("psu.transport.tcp.connect-timeout", () -> setting("PSU_MANUAL_SCPI_CONNECT_TIMEOUT", "2s"));
        registry.add("psu.transport.tcp.read-timeout", () -> setting("PSU_MANUAL_SCPI_READ_TIMEOUT", "1s"));
        registry.add("psu.transport.tcp.command-timeout", () -> setting("PSU_MANUAL_SCPI_COMMAND_TIMEOUT", "2s"));
        registry.add("psu.connection.devices.file", () -> "target/manual-devices.json");
    }

    @Test
    void connectsQueriesIdnAndDisconnectsThroughWebSocket() throws Exception {
        RecordingWebSocketHandler handler = new RecordingWebSocketHandler();
        try (WebSocketSession session = new StandardWebSocketClient()
                .execute(
                        handler,
                        new WebSocketHttpHeaders(),
                        URI.create("ws://localhost:" + serverPort + "/ws/scpi"))
                .get(5, TimeUnit.SECONDS)) {
            ensureDeviceExists(session, handler);

            sendText(session, "/connect " + DEVICE_NAME);
            assertThat(handler.nextText())
                    .isEqualTo("OK CONNECTED transport=tcp host=" + scpiHost + " port=" + scpiPort);

            sendText(session, "CMD " + DEVICE_NAME + " *IDN?");
            String idnResponse = handler.nextText();
            String expectedIdn = setting("PSU_MANUAL_SCPI_IDN_EXPECTED", "");
            if (expectedIdn.isBlank()) {
                assertThat(idnResponse).isNotBlank();
            } else {
                assertThat(idnResponse).isEqualTo(expectedIdn);
            }

            sendText(session, "/disconnect " + DEVICE_NAME);
            assertThat(handler.nextText()).isEqualTo("OK DISCONNECTED");
        }
    }

    private void ensureDeviceExists(WebSocketSession session, RecordingWebSocketHandler handler) throws Exception {
        sendText(session, "/device-list");
        String response = handler.nextText();
        if (containsDevice(response)) {
            return;
        }

        sendText(session, "/device-add " + DEVICE_NAME + ",TCP," + scpiHost + "," + scpiPort + ",");
        String addResponse = handler.nextText();
        assertThat(addResponse).startsWith("OK DEVICE_ADDED ");
        assertThat(containsDevice(addResponse)).isTrue();
    }

    private boolean containsDevice(String response) {
        return response.lines()
                .map(line -> line.split(",", -1))
                .anyMatch(parts -> parts.length >= 2 && parts[1].equals(DEVICE_NAME));
    }

    private static void sendText(WebSocketSession session, String payload) throws Exception {
        LOGGER.info("WS OUT: {}", payload);
        session.sendMessage(new TextMessage(payload));
    }

    private static String setting(String name, String defaultValue) {
        String property = System.getProperty(name);
        if (property != null && !property.isBlank()) {
            return property;
        }
        String environment = System.getenv(name);
        if (environment != null && !environment.isBlank()) {
            return environment;
        }
        return defaultValue;
    }

    @NullMarked
    private static final class RecordingWebSocketHandler extends TextWebSocketHandler {
        private final BlockingQueue<String> messages = new LinkedBlockingQueue<>();

        @Override
        protected void handleTextMessage(WebSocketSession session, TextMessage message) {
            LOGGER.info("WS IN: {}", message.getPayload());
            messages.add(message.getPayload());
        }

        private String nextText() throws InterruptedException {
            String message = messages.poll(Duration.ofSeconds(5).toMillis(), TimeUnit.MILLISECONDS);
            assertThat(message).as("next WebSocket text response").isNotNull();
            return message;
        }
    }
}
