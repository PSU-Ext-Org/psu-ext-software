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
 * Immutable live view of one script task.
 *
 * @param taskId task identifier
 * @param name human-readable task name
 * @param createdAt task creation time
 * @param startedAt execution start time, or {@code null} before execution
 * @param endedAt terminal time, or {@code null} while active
 * @param state current task state
 * @param progress current progress from {@code 0.0} to {@code 1.0}, or {@code null}
 * @param error current terminal or runtime error, or {@code null}
 * @param pendingInput active operator input request, or {@code null}
 */
public record ScriptTaskSnapshot(
        ScriptTaskId taskId,
        String name,
        Instant createdAt,
        Instant startedAt,
        Instant endedAt,
        ScriptTaskState state,
        Double progress,
        ScriptTaskError error,
        ScriptPendingInput pendingInput
) {

    /** Compatibility constructor for snapshots without a pending input request. */
    public ScriptTaskSnapshot(
            ScriptTaskId taskId, String name, Instant createdAt, Instant startedAt, Instant endedAt,
            ScriptTaskState state, Double progress, ScriptTaskError error) {
        this(taskId, name, createdAt, startedAt, endedAt, state, progress, error, null);
    }

    public ScriptTaskSnapshot {
        Objects.requireNonNull(taskId, "taskId must not be null");
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("name must not be blank");
        }
        Objects.requireNonNull(createdAt, "createdAt must not be null");
        Objects.requireNonNull(state, "state must not be null");
        validateProgress(progress);

        if (state == ScriptTaskState.PENDING_INPUT && pendingInput == null) {
            throw new IllegalArgumentException("PENDING_INPUT tasks must include pendingInput");
        }
        if (state != ScriptTaskState.PENDING_INPUT && pendingInput != null) {
            throw new IllegalArgumentException("only PENDING_INPUT tasks may include pendingInput");
        }
    }

    private static void validateProgress(Double progress) {
        if (progress != null && (progress < 0.0 || progress > 1.0 || progress.isNaN())) {
            throw new IllegalArgumentException("progress must be between 0.0 and 1.0");
        }
    }
}
