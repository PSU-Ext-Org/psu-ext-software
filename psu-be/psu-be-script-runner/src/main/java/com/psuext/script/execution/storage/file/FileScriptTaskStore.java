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

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.psuext.script.execution.model.ScriptTaskPage;
import com.psuext.script.execution.model.ScriptTaskQuery;
import com.psuext.script.execution.model.ScriptTaskRecord;
import com.psuext.script.execution.model.ScriptTaskResult;
import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.storage.ScriptTaskStore;

/** File-backed task catalogue stored as {@code task.json} in each task directory. */
public final class FileScriptTaskStore implements ScriptTaskStore {

    private static final String TASK_FILE = "task.json";
    private static final String TEMP_TASK_FILE = "task.json.tmp";
    private static final String RESULT_FILE = "result.json";

    private final Path rootDirectory;
    private final ObjectMapper objectMapper;

    /** Creates a catalogue rooted at the configured script-storage directory. */
    public FileScriptTaskStore(Path rootDirectory, ObjectMapper objectMapper) {
        this.rootDirectory = Objects.requireNonNull(rootDirectory, "rootDirectory must not be null");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper must not be null")
                .copy().findAndRegisterModules();
    }

    @Override
    public void save(ScriptTaskRecord record) {
        Path directory = rootDirectory.resolve(record.taskId().toString());
        try {
            Files.createDirectories(directory);
            Path temporary = directory.resolve(TEMP_TASK_FILE);
            Path target = directory.resolve(TASK_FILE);
            objectMapper.writeValue(temporary.toFile(), record);
            move(temporary, target);
        } catch (IOException exception) {
            throw failure("save", exception);
        }
    }

    @Override
    public ScriptTaskPage list(ScriptTaskQuery query) {
        List<ScriptTaskRecord> records = readAll().sorted(Comparator.comparing(ScriptTaskRecord::createdAt).reversed())
                .toList();
        int from = Math.min(query.offset(), records.size());
        int to = Math.min(from + query.limit(), records.size());
        return new ScriptTaskPage(records.subList(from, to), query.limit(), query.offset(), records.size());
    }

    @Override
    public Optional<ScriptTaskRecord> findById(ScriptTaskId taskId) {
        return readOrMigrate(rootDirectory.resolve(taskId.toString()));
    }

    @Override
    public List<ScriptTaskRecord> findNonTerminal() {
        return readAll().filter(record -> !record.state().isTerminal()).toList();
    }

    private Stream<ScriptTaskRecord> readAll() {
        if (!Files.isDirectory(rootDirectory)) {
            return Stream.empty();
        }
        try (DirectoryStream<Path> directories = Files.newDirectoryStream(rootDirectory)) {
            return stream(directories).map(this::readOrMigrate).flatMap(Optional::stream).toList().stream();
        } catch (IOException exception) {
            throw failure("list", exception);
        }
    }

    private Optional<ScriptTaskRecord> readOrMigrate(Path directory) {
        if (!isTaskDirectory(directory)) {
            return Optional.empty();
        }
        try {
            Path taskFile = directory.resolve(TASK_FILE);
            if (Files.isRegularFile(taskFile)) {
                return Optional.of(objectMapper.readValue(taskFile.toFile(), ScriptTaskRecord.class));
            }
            Path resultFile = directory.resolve(RESULT_FILE);
            if (!Files.isRegularFile(resultFile)) {
                return Optional.empty();
            }
            ScriptTaskRecord migrated = ScriptTaskRecord.from(
                    objectMapper.readValue(resultFile.toFile(), ScriptTaskResult.class));
            save(migrated);
            return Optional.of(migrated);
        } catch (IOException | IllegalArgumentException exception) {
            return Optional.empty();
        }
    }

    private static boolean isTaskDirectory(Path directory) {
        try {
            UUID.fromString(directory.getFileName().toString());
            return true;
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    private static Stream<Path> stream(DirectoryStream<Path> directories) {
        return StreamSupport.stream(directories.spliterator(), false);
    }

    private static void move(Path temporary, Path target) throws IOException {
        try {
            Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private static UncheckedIOException failure(String operation, IOException exception) {
        return new UncheckedIOException("Failed to " + operation + " script task catalogue", exception);
    }
}
