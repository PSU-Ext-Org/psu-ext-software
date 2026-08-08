package com.psuext.script.web.execution.script;

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

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.psuext.script.web.execution.script.support.ScriptControllerTestSupport;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

class ScriptEventsControllerTest extends ScriptControllerTestSupport {

    private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();

    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry registry) {
        registerStorage(registry, "script-events-controller");
    }

    @LocalServerPort
    private int port;

    @Test
    void replaysEventsThroughTheTerminalEvent() {
        String taskId = submitAndAwaitCompleted("events-script", "log('INFO', 'event-log'); return 1;");

        assertThat(get("/api/scripts/" + taskId + "/events?afterSequence=0"))
                .contains("event:STARTED")
                .contains("event:LOG")
                .contains("event:COMPLETED")
                .contains("event-log");
    }

    @Test
    void streamsLiveLogAndRecordEventsBeforeCancellation() throws Exception {
        String taskId = submit("events-running", """
                let sample = 0;
                while (true) {
                  log('INFO', 'live-log-' + sample);
                  record(new Date(), 'live-voltage', 'V', sample);
                  sample += 1;
                  const wakeAt = Date.now() + 10;
                  while (Date.now() < wakeAt) {
                  }
                }
                """);

        awaitState(taskId, "RUNNING");

        Set<String> eventTypes = ConcurrentHashMap.newKeySet();
        CountDownLatch liveEvents = new CountDownLatch(3);
        CompletableFuture<String> stream = CompletableFuture.supplyAsync(
                () -> collectEvents(taskId, eventTypes, liveEvents));

        assertThat(liveEvents.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(eventTypes).contains("STARTED", "LOG", "RECORD");

        restClient.post().uri("/api/scripts/{taskId}/cancel", taskId)
                .exchange().expectStatus().isAccepted();

        String events = stream.get(3, TimeUnit.SECONDS);
        assertThat(events)
                .contains("event:STARTED")
                .contains("event:LOG")
                .contains("event:RECORD")
                .contains("event:CANCELLED")
                .contains("live-log-");
    }

    @Test
    void rejectsNegativeReplaySequence() {
        String taskId = submitAndAwaitCompleted("events-invalid-sequence", "return 1;");

        restClient.get().uri("/api/scripts/{taskId}/events?afterSequence=-1", taskId)
                .exchange().expectStatus().isBadRequest()
                .expectBody(String.class).value(body -> assertThat(body)
                        .contains("\"code\":\"INVALID_REQUEST\""));
    }

    private String collectEvents(String taskId, Set<String> eventTypes, CountDownLatch liveEvents) {
        HttpRequest request = HttpRequest.newBuilder(URI.create(
                        "http://localhost:" + port + "/api/scripts/" + taskId + "/events?afterSequence=0"))
                .timeout(Duration.ofSeconds(5))
                .header("Accept", "text/event-stream")
                .GET()
                .build();
        try {
            HttpResponse<Stream<String>> response = HTTP_CLIENT.send(
                    request, HttpResponse.BodyHandlers.ofLines());
            if (response.statusCode() != 200) {
                throw new IllegalStateException("Unexpected event response status: " + response.statusCode());
            }
            try (Stream<String> lines = response.body()) {
                return lines.peek(line -> captureEventType(line, eventTypes, liveEvents))
                        .collect(Collectors.joining("\n"));
            }
        } catch (Exception exception) {
            throw new IllegalStateException("Could not collect script events", exception);
        }
    }

    private static void captureEventType(String line, Set<String> eventTypes, CountDownLatch liveEvents) {
        if (!line.startsWith("event:")) {
            return;
        }
        if (eventTypes.add(line.substring("event:".length()))) {
            liveEvents.countDown();
        }
    }
}
