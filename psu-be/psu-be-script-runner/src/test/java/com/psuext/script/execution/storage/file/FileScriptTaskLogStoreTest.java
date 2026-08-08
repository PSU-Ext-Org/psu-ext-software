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
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

import java.io.Reader;
import java.nio.file.Path;
import java.time.Instant;
import java.util.UUID;

import com.psuext.script.execution.model.ScriptResultEventLevel;
import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.storage.ScriptTaskLogWriter;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class FileScriptTaskLogStoreTest {

    @TempDir
    private Path temporaryDirectory;

    @Test
    void appendsAndReadsTaskLogLines() throws Exception {
        FileScriptTaskLogStore store = new FileScriptTaskLogStore(temporaryDirectory);
        ScriptTaskId taskId = new ScriptTaskId(UUID.fromString("dfbf15ea-7666-41aa-bd0d-95c6e32cd08a"));

        try (ScriptTaskLogWriter writer = store.open(taskId, "test")) {
            writer.append(Instant.parse("2026-07-19T12:00:00Z"), ScriptResultEventLevel.INFO, "started");
            writer.append(Instant.parse("2026-07-19T12:00:01Z"), ScriptResultEventLevel.ERROR, "failed\nsafe");
        }

        try (Reader reader = store.openReader(taskId).orElseThrow()) {
            assertThat(readAll(reader))
                    .contains("2026-07-19T12:00:00Z INFO started")
                    .contains("2026-07-19T12:00:01Z ERROR failed safe");
        }
    }

    @Test
    void returnsEmptyReaderForMissingLog() {
        FileScriptTaskLogStore store = new FileScriptTaskLogStore(temporaryDirectory);
        ScriptTaskId taskId = new ScriptTaskId(UUID.fromString("dfbf15ea-7666-41aa-bd0d-95c6e32cd08a"));

        assertThat(store.openReader(taskId)).isEmpty();
    }

    @Test
    void rejectsAppendAfterClose() {
        FileScriptTaskLogStore store = new FileScriptTaskLogStore(temporaryDirectory);
        ScriptTaskId taskId = new ScriptTaskId(UUID.fromString("dfbf15ea-7666-41aa-bd0d-95c6e32cd08a"));
        ScriptTaskLogWriter writer = store.open(taskId, "test");

        writer.close();

        assertThatExceptionOfType(IllegalStateException.class)
                .isThrownBy(() -> writer.append(
                        Instant.parse("2026-07-19T12:00:00Z"),
                        ScriptResultEventLevel.INFO,
                        "late"));
    }

    private static String readAll(Reader reader) throws Exception {
        StringBuilder builder = new StringBuilder();
        char[] buffer = new char[512];
        int read;
        while ((read = reader.read(buffer)) != -1) {
            builder.append(buffer, 0, read);
        }
        return builder.toString();
    }
}
