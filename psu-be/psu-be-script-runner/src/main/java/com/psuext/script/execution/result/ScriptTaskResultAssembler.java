package com.psuext.script.execution.result;

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
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.psuext.script.execution.model.ScriptTaskError;
import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.model.ScriptTaskResult;
import com.psuext.script.execution.model.ScriptTaskState;
import com.psuext.script.execution.model.TimeValuePoint;
import com.psuext.script.execution.model.TimeValueSeries;

/**
 * Assembles the immutable terminal result for one script task.
 *
 * <p>This class intentionally does not know how JavaScript host callbacks are
 * implemented. Runtime services append already-normalized series points here,
 * and task lifecycle code supplies the terminal status and completion time when
 * execution ends.</p>
 */
public final class ScriptTaskResultAssembler implements ScriptResultEventSink {

    private final ScriptTaskId taskId;
    private final String name;
    private final Instant createdAt;

    private final Path captureDirectory;
    private final Map<String, SeriesAccumulator> series = new LinkedHashMap<>();
    private Instant startedAt;
    private boolean completed;

    /**
     * Creates a task result assembler.
     *
     * @param taskId task id
     * @param name task name
     * @param createdAt task creation time
     */
    public ScriptTaskResultAssembler(ScriptTaskId taskId, String name, Instant createdAt) {
        this(taskId, name, createdAt, defaultCaptureDirectory(taskId));
    }

    /**
     * Creates a task result assembler that stores captured points below the supplied directory.
     *
     * @param taskId task id
     * @param name task name
     * @param createdAt task creation time
     * @param captureDirectory task-local temporary series directory
     */
    public ScriptTaskResultAssembler(ScriptTaskId taskId, String name, Instant createdAt, Path captureDirectory) {
        this.taskId = Objects.requireNonNull(taskId, "taskId must not be null");
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("name must not be blank");
        }
        this.name = name;
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt must not be null");
        this.captureDirectory = Objects.requireNonNull(captureDirectory, "captureDirectory must not be null");
    }

    /**
     * Marks script execution as started.
     *
     * @param startedAt execution start time
     */
    public synchronized void started(Instant startedAt) {
        ensureOpen();
        if (this.startedAt != null) {
            throw new IllegalStateException("task already started");
        }
        this.startedAt = Objects.requireNonNull(startedAt, "startedAt must not be null");
    }

    /**
     * Appends a point to the named time-value series.
     *
     * @param seriesName series name
     * @param unit engineering unit, or {@code null}
     * @param timestamp sample timestamp
     * @param value sample value
     */
    @Override
    public synchronized void appendSeriesPoint(String seriesName, String unit, Instant timestamp, double value) {
        ensureOpen();
        TimeValuePoint point = new TimeValuePoint(timestamp, value);
        String normalizedName = normalizeSeriesName(seriesName);
        String normalizedUnit = unit == null || unit.isBlank() ? null : unit.trim();
        series.computeIfAbsent(normalizedName,
                ignored -> new SeriesAccumulator(normalizedName, normalizedUnit, series.size()))
                .append(point);
    }

    /**
     * Builds the immutable terminal result.
     *
     * @param finalStatus terminal task status
     * @param returnValue JavaScript return value
     * @param error terminal error, or {@code null}
     * @param endedAt terminal time
     * @return immutable task result
     */
    public ScriptTaskResult complete(
            ScriptTaskState finalStatus,
            Object returnValue,
            ScriptTaskError error,
            Instant endedAt) {
        return complete(finalStatus, null, returnValue, error, endedAt);
    }

    /**
     * Builds the immutable terminal result.
     *
     * @param finalStatus terminal task status
     * @param finalProgress final progress from {@code 0.0} to {@code 1.0}, or {@code null}
     * @param returnValue JavaScript return value
     * @param error terminal error, or {@code null}
     * @param endedAt terminal time
     * @return immutable task result
     */
    public synchronized ScriptTaskResult complete(
            ScriptTaskState finalStatus,
            Double finalProgress,
            Object returnValue,
            ScriptTaskError error,
            Instant endedAt) {
        ensureOpen();
        completed = true;
        return new ScriptTaskResult(
                taskId,
                name,
                createdAt,
                startedAt,
                Objects.requireNonNull(endedAt, "endedAt must not be null"),
                finalStatus,
                finalProgress,
                returnValue,
                error,
                buildSeries(),
                Map.of("apiVersion", 1));
    }

    private List<TimeValueSeries> buildSeries() {
        return series.values().stream()
                .map(SeriesAccumulator::build)
                .toList();
    }

    private void ensureOpen() {
        if (completed) {
            throw new IllegalStateException("task result has already been completed");
        }
    }

    private static String normalizeSeriesName(String seriesName) {
        if (seriesName == null || seriesName.isBlank()) {
            throw new IllegalArgumentException("seriesName must not be blank");
        }
        return seriesName.trim();
    }

    private final class SeriesAccumulator {

        private final String name;
        private final String unit;
        private final int index;
        private TimeValuePoint firstPoint;
        private long sampleCount;

        private SeriesAccumulator(String name, String unit, int index) {
            this.name = name;
            this.unit = unit;
            this.index = index;
        }

        private void append(TimeValuePoint point) {
            if (firstPoint == null) {
                firstPoint = point;
            }
            Path captureFile = captureDirectory.resolve("series-" + index + ".tsv");
            try {
                Files.createDirectories(captureDirectory);
                Files.writeString(captureFile, point.timestamp() + "\t" + point.value() + "\n", StandardCharsets.UTF_8,
                        StandardOpenOption.CREATE, StandardOpenOption.APPEND);
                sampleCount++;
            } catch (IOException exception) {
                throw new UncheckedIOException("Failed to append script result series point", exception);
            }
        }

        private TimeValueSeries build() {
            return new TimeValueSeries(name, unit, firstPoint == null ? List.of() : List.of(firstPoint),
                    Map.of("sampleCount", sampleCount));
        }
    }

    private static Path defaultCaptureDirectory(ScriptTaskId taskId) {
        return Path.of(System.getProperty("java.io.tmpdir"), "psu-ext-script-series", taskId.toString());
    }
}
