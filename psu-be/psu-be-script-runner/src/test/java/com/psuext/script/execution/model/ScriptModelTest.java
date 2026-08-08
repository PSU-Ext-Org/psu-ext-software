package com.psuext.script.execution.model;

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
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class ScriptModelTest {

    @Test
    void taskIdRejectsNullUuid() {
        assertThatExceptionOfType(NullPointerException.class)
                .isThrownBy(() -> new ScriptTaskId(null));
    }

    @Test
    void startRequestDefaultsNameAndTimeout() {
        ScriptStartRequest request = new ScriptStartRequest(" ", "return 1;", null);

        assertThat(request.name()).isEqualTo("Untitled script");
        assertThat(request.timeout()).isEqualTo(Duration.ofMinutes(70));
    }

    @Test
    void startRequestRejectsBlankSourceAndNonPositiveTimeout() {
        assertThatExceptionOfType(IllegalArgumentException.class)
                .isThrownBy(() -> new ScriptStartRequest("test", " ", Duration.ofSeconds(1)));
        assertThatExceptionOfType(IllegalArgumentException.class)
                .isThrownBy(() -> new ScriptStartRequest("test", "return 1;", Duration.ZERO));
    }

    @Test
    void taskStateIdentifiesTerminalStates() {
        assertThat(ScriptTaskState.COMPLETED.isTerminal()).isTrue();
        assertThat(ScriptTaskState.FAILED.isTerminal()).isTrue();
        assertThat(ScriptTaskState.CANCELLED.isTerminal()).isTrue();
        assertThat(ScriptTaskState.TIMED_OUT.isTerminal()).isTrue();
        assertThat(ScriptTaskState.RUNNING.isTerminal()).isFalse();
    }

    @Test
    void resultRejectsNonTerminalFinalStatus() {
        assertThatExceptionOfType(IllegalArgumentException.class)
                .isThrownBy(() -> result(ScriptTaskState.RUNNING));
    }

    @Test
    void resultCopiesCollections() {
        ScriptTaskResult result = new ScriptTaskResult(
                new ScriptTaskId(UUID.randomUUID()),
                "test",
                Instant.EPOCH,
                Instant.EPOCH,
                Instant.EPOCH.plusSeconds(1),
                ScriptTaskState.COMPLETED,
                1.0,
                42,
                null,
                null,
                Map.of("apiVersion", 1));

        assertThat(result.series()).isEmpty();
    }

    @Test
    void resultModelsSerializeToJson() throws Exception {
        ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
        ScriptTaskResult result = result(ScriptTaskState.COMPLETED);

        String json = objectMapper.writeValueAsString(result);

        assertThat(json).contains("\"finalStatus\":\"COMPLETED\"");
        assertThat(json).doesNotContain("\"eventLog\"");
        assertThat(json).contains("\"series\"");
    }

    private static ScriptTaskResult result(ScriptTaskState finalStatus) {
        Instant createdAt = Instant.parse("2026-07-19T12:00:00Z");
        return new ScriptTaskResult(
                new ScriptTaskId(UUID.fromString("dfbf15ea-7666-41aa-bd0d-95c6e32cd08a")),
                "test",
                createdAt,
                createdAt.plusMillis(10),
                createdAt.plusMillis(20),
                finalStatus,
                1.0,
                Map.of("ok", true),
                null,
                List.of(new TimeValueSeries(
                        "voltage",
                        "V",
                        List.of(new TimeValuePoint(createdAt, 12.0)),
                        Map.of("sampleCount", 1))),
                Map.of("apiVersion", 1));
    }
}
