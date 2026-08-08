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

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.Reader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

import com.psuext.script.execution.model.ScriptResultEventLevel;
import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.storage.ScriptTaskLogStore;
import com.psuext.script.execution.storage.ScriptTaskLogWriter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * File-backed task log store using one task directory per log.
 */
public final class FileScriptTaskLogStore implements ScriptTaskLogStore {

    private static final Logger LOGGER = LoggerFactory.getLogger(FileScriptTaskLogStore.class);
    private static final String LOG_FILE_NAME = "task.log";

    private final Path rootDirectory;

    /**
     * Creates a file-backed task log store.
     *
     * @param rootDirectory root log directory
     */
    public FileScriptTaskLogStore(Path rootDirectory) {
        this.rootDirectory = Objects.requireNonNull(rootDirectory, "rootDirectory must not be null");
    }

    @Override
    public ScriptTaskLogWriter open(ScriptTaskId taskId, String taskName) {
        Objects.requireNonNull(taskId, "taskId must not be null");
        if (taskName == null || taskName.isBlank()) {
            throw new IllegalArgumentException("taskName must not be blank");
        }
        Path taskDirectory = taskDirectory(taskId);
        Path logFile = taskDirectory.resolve(LOG_FILE_NAME);
        try {
            Files.createDirectories(taskDirectory);
            BufferedWriter writer = Files.newBufferedWriter(
                    logFile,
                    StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.APPEND);
            LOGGER.debug("Script task log opened: taskId={}", taskId);
            return new FileScriptTaskLogWriter(writer);
        } catch (IOException ex) {
            throw storageFailure("open", taskId, ex);
        }
    }

    @Override
    public Optional<Reader> openReader(ScriptTaskId taskId) {
        Objects.requireNonNull(taskId, "taskId must not be null");
        Path logFile = taskDirectory(taskId).resolve(LOG_FILE_NAME);
        if (!Files.isRegularFile(logFile)) {
            return Optional.empty();
        }
        try {
            Reader reader = Files.newBufferedReader(logFile, StandardCharsets.UTF_8);
            LOGGER.debug("Script task log reader opened: taskId={}", taskId);
            return Optional.of(reader);
        } catch (IOException ex) {
            throw storageFailure("open_reader", taskId, ex);
        }
    }

    private Path taskDirectory(ScriptTaskId taskId) {
        return rootDirectory.resolve(taskId.toString());
    }

    private UncheckedIOException storageFailure(String operation, ScriptTaskId taskId, IOException exception) {
        LOGGER.error("Script task log storage failed: operation={} taskId={} root={}",
                operation, taskId, rootDirectory, exception);

        return new UncheckedIOException("Failed to " + operation + " script task log: " + taskId, exception);
    }

    private static final class FileScriptTaskLogWriter implements ScriptTaskLogWriter {

        private final BufferedWriter writer;
        private boolean closed;

        private FileScriptTaskLogWriter(BufferedWriter writer) {
            this.writer = writer;
        }

        @Override
        public synchronized void append(Instant timestamp, ScriptResultEventLevel level, String message) {
            Objects.requireNonNull(timestamp, "timestamp must not be null");
            Objects.requireNonNull(level, "level must not be null");
            if (closed) {
                throw new IllegalStateException("task log writer is closed");
            }
            try {
                writer.write(timestamp + " " + level + " " + sanitize(message));
                writer.newLine();
                writer.flush();
            } catch (IOException ex) {
                throw new UncheckedIOException("Failed to append script task log line", ex);
            }
        }

        @Override
        public synchronized void close() {
            if (closed) {
                return;
            }
            try {
                writer.close();
                closed = true;
            } catch (IOException ex) {
                throw new UncheckedIOException("Failed to close script task log writer", ex);
            }
        }

        private static String sanitize(String message) {
            if (message == null) {
                return "";
            }
            return message.replace('\r', ' ').replace('\n', ' ');
        }
    }
}
