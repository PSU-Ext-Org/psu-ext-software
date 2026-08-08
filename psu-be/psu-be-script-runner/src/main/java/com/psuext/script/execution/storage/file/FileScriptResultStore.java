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
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.psuext.script.execution.model.ScriptResultQuery;
import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.model.ScriptTaskResult;
import com.psuext.script.execution.model.ScriptTaskResultSummary;
import com.psuext.script.execution.model.TimeValuePoint;
import com.psuext.script.execution.model.TimeValueSeries;
import com.psuext.script.execution.model.TimeValuePointStreamSource;
import com.psuext.script.execution.storage.ScriptResultStore;
import com.psuext.script.execution.storage.ScriptSeriesRange;
import com.psuext.script.execution.storage.ScriptTaskSeriesRead;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * File-backed script result store using one task directory per result.
 */
public final class FileScriptResultStore implements ScriptResultStore {

    private static final Logger LOGGER = LoggerFactory.getLogger(FileScriptResultStore.class);
    private static final String RESULT_FILE_NAME = "result.json";
    private static final String TEMP_RESULT_FILE_NAME = "result.json.tmp";
    private static final String SUMMARY_FILE_NAME = "summary.json";
    private static final String TEMP_SUMMARY_FILE_NAME = "summary.json.tmp";
    private static final String SERIES_DIRECTORY_NAME = ".series";

    private final Path rootDirectory;
    private final ObjectMapper objectMapper;

    /**
     * Creates a file-backed result store.
     *
     * @param rootDirectory root result directory
     * @param objectMapper JSON mapper
     */
    public FileScriptResultStore(Path rootDirectory, ObjectMapper objectMapper) {
        this.rootDirectory = Objects.requireNonNull(rootDirectory, "rootDirectory must not be null");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper must not be null")
                .copy()
                .findAndRegisterModules();
    }

    @Override
    public void save(ScriptTaskResult result) {
        Objects.requireNonNull(result, "result must not be null");
        Path taskDirectory = taskDirectory(result.taskId());
        Path temporaryFile = taskDirectory.resolve(TEMP_RESULT_FILE_NAME);
        Path resultFile = taskDirectory.resolve(RESULT_FILE_NAME);
        Path temporarySummaryFile = taskDirectory.resolve(TEMP_SUMMARY_FILE_NAME);
        Path summaryFile = taskDirectory.resolve(SUMMARY_FILE_NAME);
        try {
            Files.createDirectories(taskDirectory);
            objectMapper.writeValue(temporarySummaryFile.toFile(), ScriptTaskResultSummary.from(result));
            writeResult(temporaryFile, result);
            moveResultIntoPlace(temporarySummaryFile, summaryFile);
            moveResultIntoPlace(temporaryFile, resultFile);
            deleteCaptureDirectory(taskDirectory.resolve(SERIES_DIRECTORY_NAME));
            LOGGER.debug("Script result stored: taskId={}", result.taskId());
        } catch (IOException ex) {
            throw storageFailure("save", result.taskId(), ex);
        }
    }

    @Override
    public Optional<ScriptTaskResult> findById(ScriptTaskId taskId) {
        Objects.requireNonNull(taskId, "taskId must not be null");
        Path resultFile = taskDirectory(taskId).resolve(RESULT_FILE_NAME);
        if (!Files.isRegularFile(resultFile)) {
            return Optional.empty();
        }
        try {
            return Optional.of(readPreview(resultFile));
        } catch (IOException ex) {
            throw storageFailure("read", taskId, ex);
        }
    }

    @Override
    public Optional<ScriptTaskSeriesRead> openSeries(ScriptTaskId taskId, String seriesName, ScriptSeriesRange range) {
        Objects.requireNonNull(taskId, "taskId must not be null");
        Objects.requireNonNull(seriesName, "seriesName must not be null");
        Objects.requireNonNull(range, "range must not be null");
        Path resultFile = taskDirectory(taskId).resolve(RESULT_FILE_NAME);
        if (!Files.isRegularFile(resultFile) || findSeries(resultFile, seriesName).isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new FileScriptTaskSeriesRead(resultFile, seriesName, range, objectMapper));
    }

    @Override
    public List<ScriptTaskResultSummary> list(ScriptResultQuery query) {
        ScriptResultQuery effectiveQuery = query == null ? ScriptResultQuery.recent() : query;
        if (!Files.isDirectory(rootDirectory)) {
            return List.of();
        }
        try (DirectoryStream<Path> taskDirectories = Files.newDirectoryStream(rootDirectory)) {
            try (Stream<Path> paths = stream(taskDirectories)) {
                return paths
                        .map(this::readSummary)
                        .flatMap(Optional::stream)
                        .filter(summary -> matches(summary, effectiveQuery))
                        .sorted(Comparator.comparing(ScriptTaskResultSummary::endedAt).reversed())
                        .skip(effectiveQuery.offset())
                        .limit(effectiveQuery.limit())
                        .toList();
            }
        } catch (IOException ex) {
            throw storageFailure("list", null, ex);
        }
    }

    @Override
    public void delete(ScriptTaskId taskId) {
        Objects.requireNonNull(taskId, "taskId must not be null");
        Path taskDirectory = taskDirectory(taskId);
        if (!Files.exists(taskDirectory)) {
            return;
        }
        try (Stream<Path> paths = Files.walk(taskDirectory)) {
            List<Path> pathsToDelete = paths
                    .sorted(Comparator.reverseOrder())
                    .toList();
            for (Path path : pathsToDelete) {
                Files.deleteIfExists(path);
            }
            LOGGER.debug("Script result deleted: taskId={}", taskId);
        } catch (IOException ex) {
            throw storageFailure("delete", taskId, ex);
        }
    }

    private void writeResult(Path file, ScriptTaskResult result) throws IOException {
        java.util.IdentityHashMap<List<TimeValuePoint>, Path> captureFiles = new java.util.IdentityHashMap<>();
        for (int index = 0; index < result.series().size(); index++) {
            captureFiles.put(result.series().get(index).points(), taskDirectory(result.taskId())
                    .resolve(SERIES_DIRECTORY_NAME).resolve("series-" + index + ".tsv"));
        }
        TimeValuePointStreamSource source = (preview, generator) ->
                writeCapturePoints(generator, captureFiles.get(preview), preview);
        objectMapper.writer().withAttribute(TimeValuePointStreamSource.ATTRIBUTE, source).writeValue(file.toFile(), result);
    }

    private static void writeCapturePoints(com.fasterxml.jackson.core.JsonGenerator json, Path captureFile,
            List<TimeValuePoint> preview) throws IOException {
        json.writeStartArray();
        if (captureFile != null && Files.isRegularFile(captureFile)) {
            try (var lines = Files.lines(captureFile, StandardCharsets.UTF_8)) {
                for (String line : (Iterable<String>) lines::iterator) {
                    TimeValuePoint point = parseCapturePoint(line);
                    json.writeStartObject();
                    json.writeObjectField("timestamp", point.timestamp());
                    json.writeNumberField("value", point.value());
                    json.writeEndObject();
                }
            }
        } else {
            for (TimeValuePoint point : preview) {
                json.writeObject(point);
            }
        }
        json.writeEndArray();
    }

    private ScriptTaskResult readPreview(Path resultFile) throws IOException {
        return objectMapper.readValue(resultFile.toFile(), ScriptTaskResult.class);
    }

    private Optional<TimeValueSeries> findSeries(Path resultFile, String requestedName) {
        try (JsonParser parser = objectMapper.getFactory().createParser(resultFile.toFile())) {
            require(parser.nextToken(), JsonToken.START_OBJECT);
            while (parser.nextToken() != JsonToken.END_OBJECT) {
                String field = parser.currentName();
                parser.nextToken();
                if (!"series".equals(field)) {
                    parser.skipChildren();
                    continue;
                }
                while (parser.nextToken() != JsonToken.END_ARRAY) {
                    TimeValueSeries series = objectMapper.readValue(parser, TimeValueSeries.class);
                    if (requestedName.equals(series.name())) {
                        return Optional.of(series);
                    }
                }
                return Optional.empty();
            }
            return Optional.empty();
        } catch (IOException exception) {
            throw storageFailure("read series", null, exception);
        }
    }

    private static TimeValuePoint parseCapturePoint(String line) {
        int separator = line.indexOf('\t');
        if (separator < 1) {
            throw new IllegalArgumentException("Invalid captured script series point");
        }
        return new TimeValuePoint(Instant.parse(line.substring(0, separator)), Double.parseDouble(line.substring(separator + 1)));
    }

    private static void require(JsonToken actual, JsonToken expected) {
        if (actual != expected) {
            throw new IllegalArgumentException("Expected JSON token " + expected + " but got " + actual);
        }
    }

    private Path taskDirectory(ScriptTaskId taskId) {
        return rootDirectory.resolve(taskId.toString());
    }

    private Optional<ScriptTaskResultSummary> readSummary(Path taskDirectory) {
        Path resultFile = taskDirectory.resolve(RESULT_FILE_NAME);
        Path summaryFile = taskDirectory.resolve(SUMMARY_FILE_NAME);
        if (!isUuidDirectory(taskDirectory)) {
            return Optional.empty();
        }
        if (!Files.isRegularFile(resultFile) || !Files.isRegularFile(summaryFile)) {
            LOGGER.warn("Incomplete script result skipped: taskDirectory={}", taskDirectory.getFileName());
            return Optional.empty();
        }
        try {
            return Optional.of(objectMapper.readValue(summaryFile.toFile(), ScriptTaskResultSummary.class));
        } catch (IOException ex) {
            LOGGER.warn("Corrupt script result skipped: taskDirectory={} error={}",
                    taskDirectory.getFileName(), ex.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    private UncheckedIOException storageFailure(String operation, ScriptTaskId taskId, IOException exception) {
        LOGGER.error("Script result storage failed: operation={} taskId={} root={}",
                operation, taskId, rootDirectory, exception);
        return new UncheckedIOException("Failed to " + operation + " script result" + taskSuffix(taskId), exception);
    }

    private static String taskSuffix(ScriptTaskId taskId) {
        return taskId == null ? "" : ": " + taskId;
    }

    private static boolean isUuidDirectory(Path taskDirectory) {
        try {
            UUID.fromString(taskDirectory.getFileName().toString());
            return true;
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    private static boolean matches(ScriptTaskResultSummary summary, ScriptResultQuery query) {
        return matchesStatus(summary, query)
                && matchesStartedAfter(summary, query.startedAfter())
                && matchesStartedBefore(summary, query.startedBefore());
    }

    private static boolean matchesStatus(ScriptTaskResultSummary summary, ScriptResultQuery query) {
        return query.finalStatus() == null || summary.finalStatus() == query.finalStatus();
    }

    private static boolean matchesStartedAfter(ScriptTaskResultSummary summary, Instant startedAfter) {
        return startedAfter == null || summary.startedAt() != null && !summary.startedAt().isBefore(startedAfter);
    }

    private static boolean matchesStartedBefore(ScriptTaskResultSummary summary, Instant startedBefore) {
        return startedBefore == null || summary.startedAt() != null && !summary.startedAt().isAfter(startedBefore);
    }

    private static Stream<Path> stream(DirectoryStream<Path> directoryStream) {
        return StreamSupport.stream(directoryStream.spliterator(), false);
    }

    private static void moveResultIntoPlace(Path temporaryFile, Path resultFile) throws IOException {
        try {
            Files.move(
                    temporaryFile,
                    resultFile,
                    StandardCopyOption.ATOMIC_MOVE,
                    StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ex) {
            Files.move(temporaryFile, resultFile, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private static void deleteCaptureDirectory(Path captureDirectory) throws IOException {
        if (!Files.exists(captureDirectory)) {
            return;
        }
        try (Stream<Path> paths = Files.walk(captureDirectory)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                Files.deleteIfExists(path);
            }
        }
    }
}
