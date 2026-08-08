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
 * Durable task-catalogue entry used to list script work across process restarts.
 */
public record ScriptTaskRecord(
        ScriptTaskId taskId,
        String name,
        Instant createdAt,
        Instant startedAt,
        Instant endedAt,
        ScriptTaskState state,
        Double progress,
        ScriptTaskError error
) {

    public ScriptTaskRecord {
        Objects.requireNonNull(taskId, "taskId must not be null");
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("name must not be blank");
        }
        Objects.requireNonNull(createdAt, "createdAt must not be null");
        Objects.requireNonNull(state, "state must not be null");
        if (state.isTerminal() && endedAt == null) {
            throw new IllegalArgumentException("terminal tasks must have an end time");
        }
    }

    /** Creates a durable record from a live snapshot. */
    public static ScriptTaskRecord from(ScriptTaskSnapshot snapshot) {
        return new ScriptTaskRecord(snapshot.taskId(), snapshot.name(), snapshot.createdAt(), snapshot.startedAt(),
                snapshot.endedAt(), snapshot.state(), snapshot.progress(), snapshot.error());
    }

    /** Creates a durable record from a terminal result retained by an older runner version. */
    public static ScriptTaskRecord from(ScriptTaskResult result) {
        return new ScriptTaskRecord(result.taskId(), result.name(), result.createdAt(), result.startedAt(),
                result.endedAt(), result.finalStatus(), result.finalProgress(), result.error());
    }
}
