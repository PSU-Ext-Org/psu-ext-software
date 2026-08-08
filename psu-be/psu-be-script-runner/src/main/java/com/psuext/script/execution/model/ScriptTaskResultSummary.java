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
import java.util.Objects;

/**
 * Lightweight summary for a stored terminal script task result.
 *
 * @param taskId task identifier
 * @param name human-readable task name
 * @param startedAt execution start time, or {@code null} for pre-start failures
 * @param endedAt terminal time
 * @param finalStatus terminal task state
 */
public record ScriptTaskResultSummary(
        ScriptTaskId taskId,
        String name,
        Instant startedAt,
        Instant endedAt,
        ScriptTaskState finalStatus
) {

    public ScriptTaskResultSummary {
        Objects.requireNonNull(taskId, "taskId must not be null");
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("name must not be blank");
        }
        Objects.requireNonNull(endedAt, "endedAt must not be null");
        Objects.requireNonNull(finalStatus, "finalStatus must not be null");
        if (!finalStatus.isTerminal()) {
            throw new IllegalArgumentException("finalStatus must be terminal");
        }
    }

    /**
     * Creates a result summary from a full task result.
     *
     * @param result stored task result
     * @return summary view
     */
    public static ScriptTaskResultSummary from(ScriptTaskResult result) {
        return new ScriptTaskResultSummary(
                result.taskId(),
                result.name(),
                result.startedAt(),
                result.endedAt(),
                result.finalStatus());
    }
}
