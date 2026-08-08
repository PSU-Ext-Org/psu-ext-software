package com.psuext.script.execution.storage.file;

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

import java.nio.file.Files;
import java.nio.file.Path;
import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.psuext.script.execution.model.*;
import com.psuext.script.execution.storage.ScriptSeriesRange;
import com.psuext.script.test.logging.LogCapture;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class FileScriptResultStoreTest {

    @TempDir
    private Path temporaryDirectory;

    @Test
    void savesAndLoadsResult() {
        FileScriptResultStore store = newStore(temporaryDirectory);
        ScriptTaskResult result = result("dfbf15ea-7666-41aa-bd0d-95c6e32cd08a", "first", ScriptTaskState.COMPLETED);

        try (LogCapture logs = LogCapture.forClass(FileScriptResultStore.class)) {
            store.save(result);

            assertThat(logs.messages()).anyMatch(message -> message.contains("Script result stored: taskId="));
            assertThat(logs.messages()).noneMatch(message -> message.contains("answer"));
        }
        assertThat(store.findById(result.taskId())).contains(result);
        assertThat(temporaryDirectory.resolve(result.taskId().toString()).resolve("result.json")).isRegularFile();
    }

    @Test
    void listsResultSummariesWithStatusFilterAndPaging() {
        FileScriptResultStore store = newStore(temporaryDirectory);
        ScriptTaskResult first = result("dfbf15ea-7666-41aa-bd0d-95c6e32cd08a", "first", ScriptTaskState.COMPLETED);
        ScriptTaskResult second = result("60216bd9-7151-4ec2-95cd-a38e2c296514", "second", ScriptTaskState.FAILED);
        store.save(first);
        store.save(second);

        List<String> names = store.list(new ScriptResultQuery(10, 0, ScriptTaskState.COMPLETED, null, null))
                .stream()
                .map(ScriptTaskResultSummary::name)
                .toList();

        assertThat(names).containsExactly("first");
        assertThat(store.list(new ScriptResultQuery(1, 1, null, null, null))).hasSize(1);
    }

    @Test
    void deletesStoredResultDirectory() {
        FileScriptResultStore store = newStore(temporaryDirectory);
        ScriptTaskResult result = result("dfbf15ea-7666-41aa-bd0d-95c6e32cd08a", "first", ScriptTaskState.COMPLETED);
        store.save(result);

        store.delete(result.taskId());

        assertThat(store.findById(result.taskId())).isEmpty();
        assertThat(temporaryDirectory.resolve(result.taskId().toString())).doesNotExist();
    }

    @Test
    void resavingResultReplacesExistingResult() throws Exception {
        FileScriptResultStore store = newStore(temporaryDirectory);
        ScriptTaskId taskId = new ScriptTaskId(UUID.fromString("dfbf15ea-7666-41aa-bd0d-95c6e32cd08a"));
        ScriptTaskResult first = result(taskId, "first", ScriptTaskState.COMPLETED);
        ScriptTaskResult second = result(taskId, "second", ScriptTaskState.FAILED);

        store.save(first);
        store.save(second);

        assertThat(store.findById(taskId)).contains(second);
        String json = Files.readString(temporaryDirectory.resolve(taskId.toString()).resolve("result.json"));
        assertThat(json).contains("\"name\":\"second\"");
    }

    @Test
    void ignoresCorruptPartialAndOrphanedSummaryEntries() throws Exception {
        FileScriptResultStore store = newStore(temporaryDirectory);
        ScriptTaskResult result = result("dfbf15ea-7666-41aa-bd0d-95c6e32cd08a", "first", ScriptTaskState.COMPLETED);
        store.save(result);
        Path corrupt = temporaryDirectory.resolve("60216bd9-7151-4ec2-95cd-a38e2c296514");
        Files.createDirectories(corrupt);
        Files.writeString(corrupt.resolve("result.json"), "{}");
        Files.writeString(corrupt.resolve("summary.json"), "not-json");
        Path orphan = temporaryDirectory.resolve("345ce4dc-0859-444f-be72-7c54443e1707");
        Files.createDirectories(orphan);
        Files.writeString(orphan.resolve("summary.json"), "{}");

        try (LogCapture logs = LogCapture.forClass(FileScriptResultStore.class)) {
            assertThat(store.list(ScriptResultQuery.recent())).extracting(ScriptTaskResultSummary::taskId)
                    .containsExactly(result.taskId());
            assertThat(logs.messages()).anyMatch(message -> message.startsWith("Corrupt script result skipped"));
            assertThat(logs.messages()).anyMatch(message -> message.startsWith("Incomplete script result skipped"));
        }
    }

    @Test
    void readsFirstPointAsResultPreviewAndStreamsRequestedSeriesRange() throws Exception {
        FileScriptResultStore store = newStore(temporaryDirectory);
        ScriptTaskResult result = resultWithThreePoints();
        store.save(result);

        assertThat(store.findById(result.taskId()).orElseThrow().series().get(0).points())
                .extracting(TimeValuePoint::value).containsExactly(1.0);

        var read = store.openSeries(result.taskId(), "voltage", new ScriptSeriesRange(1, 1L)).orElseThrow();
        ByteArrayOutputStream json = new ByteArrayOutputStream();
        ByteArrayOutputStream csv = new ByteArrayOutputStream();
        read.writeJsonTo(json);
        read.writeCsvTo(csv);

        assertThat(json.toString()).contains("\"value\":2.5").doesNotContain("\"value\":3.75");
        assertThat(csv.toString()).isEqualTo("\"name\",\"voltage\"\n\"unit\",\"V\"\ntimestamp,value\n2026-07-19T12:00:01Z,2.5\n");
    }

    private static FileScriptResultStore newStore(Path directory) {
        return new FileScriptResultStore(directory, new ObjectMapper());
    }

    private static ScriptTaskResult result(String taskId, String name, ScriptTaskState finalStatus) {
        return result(new ScriptTaskId(UUID.fromString(taskId)), name, finalStatus);
    }

    private static ScriptTaskResult result(ScriptTaskId taskId, String name, ScriptTaskState finalStatus) {
        Instant createdAt = Instant.parse("2026-07-19T12:00:00Z");
        return new ScriptTaskResult(
                taskId,
                name,
                createdAt,
                createdAt.plusMillis(10),
                createdAt.plusMillis(20),
                finalStatus,
                1.0,
                Map.of("ok", finalStatus == ScriptTaskState.COMPLETED),
                null,
                List.of(new TimeValueSeries(
                        "voltage",
                        "V",
                        List.of(new TimeValuePoint(createdAt, 12.0)),
                        Map.of())),
                Map.of("apiVersion", 1));
    }

    private static ScriptTaskResult resultWithThreePoints() {
        Instant createdAt = Instant.parse("2026-07-19T12:00:00Z");
        return new ScriptTaskResult(
                new ScriptTaskId(UUID.fromString("dfbf15ea-7666-41aa-bd0d-95c6e32cd08a")),
                "series", createdAt, createdAt, createdAt.plusSeconds(3), ScriptTaskState.COMPLETED, 1.0,
                null, null, List.of(new TimeValueSeries("voltage", "V", List.of(
                new TimeValuePoint(createdAt, 1.0),
                new TimeValuePoint(createdAt.plusSeconds(1), 2.5),
                new TimeValuePoint(createdAt.plusSeconds(2), 3.75)), Map.of("sampleCount", 3))), Map.of());
    }
}
