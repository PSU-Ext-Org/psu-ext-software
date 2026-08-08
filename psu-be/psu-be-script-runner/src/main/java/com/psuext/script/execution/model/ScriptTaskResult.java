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

import java.time.Instant;
import java.util.Map;
import java.util.List;
import java.util.Objects;

/**
 * Durable terminal result for one script task.
 *
 * @param taskId task identifier
 * @param name human-readable task name
 * @param createdAt task creation time
 * @param startedAt execution start time, or {@code null} for pre-start failures
 * @param endedAt terminal time
 * @param finalStatus terminal task state
 * @param finalProgress final progress from {@code 0.0} to {@code 1.0}, or {@code null}
 * @param returnValue value returned by JavaScript, or {@code null}
 * @param error terminal error, or {@code null} for successful completion
 * @param series captured time-value series
 * @param metadata JSON-compatible implementation metadata
 */
public record ScriptTaskResult(
        ScriptTaskId taskId,
        String name,
        Instant createdAt,
        Instant startedAt,
        Instant endedAt,
        ScriptTaskState finalStatus,
        Double finalProgress,
        Object returnValue,
        ScriptTaskError error,
        List<TimeValueSeries> series,
        Map<String, Object> metadata
) {

    public ScriptTaskResult {
        Objects.requireNonNull(taskId, "taskId must not be null");
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("name must not be blank");
        }
        Objects.requireNonNull(createdAt, "createdAt must not be null");
        Objects.requireNonNull(endedAt, "endedAt must not be null");
        Objects.requireNonNull(finalStatus, "finalStatus must not be null");
        if (!finalStatus.isTerminal()) {
            throw new IllegalArgumentException("finalStatus must be terminal");
        }
        validateProgress(finalProgress);
        series = series == null ? List.of() : List.copyOf(series);
        metadata = metadata == null ? Map.of() : Map.copyOf(metadata);
    }

    private static void validateProgress(Double progress) {
        if (progress != null && (progress < 0.0 || progress > 1.0 || progress.isNaN())) {
            throw new IllegalArgumentException("finalProgress must be between 0.0 and 1.0");
        }
    }
}
