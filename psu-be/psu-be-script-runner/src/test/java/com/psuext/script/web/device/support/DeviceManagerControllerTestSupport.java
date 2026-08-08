package com.psuext.script.web.device.support;

/*-
 * #%L
 * PSU-BE Script Runner
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

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

import com.psuext.test.scpi.FakeScpiTcpServer;
import org.awaitility.Awaitility;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * Shared HTTP integration-test fixture for the device manager and script controller.
 *
 * <p>The fixture starts one SCPI simulator for the test JVM and writes the matching
 * {@code devices.json} before Spring creates the connection registry.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
public abstract class DeviceManagerControllerTestSupport {

    protected static final int DEVICE_ID = 0;
    protected static final String DEVICE_NAME = "PSU1";
    protected static final int SECOND_DEVICE_ID = 1;
    protected static final String SECOND_DEVICE_NAME = "PSU2";
    protected static final int THIRD_DEVICE_ID = 2;
    protected static final String THIRD_DEVICE_NAME = "PSU3";
    protected static final String IDN_RESPONSE = "PSU-EXT,PSU-EXT,TEST-0001,0.1.0";
    protected static final String DEVICE_PROFILE_JSON = """
            {
              "name": "PSU1",
              "type": "TCP",
              "ip": "127.0.0.1",
              "port": "5025"
            }
            """;

    private static final String DEVICES_JSON = """
            [
              {
                "id": %d,
                "name": "%s",
                "type": "TCP",
                "ip": "127.0.0.1",
                "port": "%d",
                "baudrate": null
              },
              {
                "id": %d,
                "name": "%s",
                "type": "TCP",
                "ip": "127.0.0.1",
                "port": "5026",
                "baudrate": null
              },
              {
                "id": %d,
                "name": "%s",
                "type": "TCP",
                "ip": "127.0.0.1",
                "port": "5027",
                "baudrate": null
              }
            ]
            """;
    private static final Path DEVICE_FILE = Path.of("target/phase11-http-devices.json");
    protected static FakeScpiTcpServer server;

    @Autowired
    protected RestTestClient restClient;

    @DynamicPropertySource
    static void connectionProperties(DynamicPropertyRegistry registry) {
        ensureSimulator();
        registry.add("psu.connection.devices.file", DEVICE_FILE::toString);
        registry.add("psu.transport.tcp.connect-timeout", () -> "1s");
        registry.add("psu.transport.tcp.read-timeout", () -> "2s");
        registry.add("psu.transport.tcp.command-timeout", () -> "2s");
    }

    protected void connect(Object idOrName) {
        restClient.post().uri("/api/devices/{idOrName}/connect", idOrName)
                .exchange().expectStatus().isOk()
                .expectBody(String.class).value(body -> assertThat(body)
                        .contains("\"operation\":\"connect\""));
    }

    protected void awaitConnected() {
        Awaitility.await().atMost(Duration.ofSeconds(2)).untilAsserted(() ->
                assertThat(get("/api/devices")).contains("\"state\":\"CONNECTED\""));
    }

    protected String get(String uri) {
        return restClient.get().uri(uri).exchange()
                .expectStatus().isOk()
                .expectBody(String.class).returnResult().getResponseBody();
    }

    protected static void assertUnsupported(String body, String operation) {
        assertThat(body)
                .contains("\"operation\":\"" + operation + "\"")
                .contains("\"code\":\"OPERATION_NOT_SUPPORTED\"");
    }

    private static synchronized void ensureSimulator() {
        if (server != null) {
            return;
        }
        try {
            server = FakeScpiTcpServer.start().respondTo("*IDN?", IDN_RESPONSE);
            Files.createDirectories(DEVICE_FILE.toAbsolutePath().getParent());
            Files.writeString(DEVICE_FILE, DEVICES_JSON.formatted(
                    DEVICE_ID, DEVICE_NAME, server.port(),
                    SECOND_DEVICE_ID, SECOND_DEVICE_NAME,
                    THIRD_DEVICE_ID, THIRD_DEVICE_NAME));
            Runtime.getRuntime().addShutdownHook(new Thread(DeviceManagerControllerTestSupport::stopSimulator));
        } catch (IOException exception) {
            throw new UncheckedIOException("Could not initialize the SCPI simulator", exception);
        }
    }

    private static void stopSimulator() {
        try {
            if (server != null) {
                server.close();
            }
        } catch (Exception ignored) {
            // The test JVM is already stopping; the simulator socket is no longer needed.
        }
    }
}
