package com.psuext.script.web.execution.model;

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

import com.psuext.script.execution.model.ScriptTaskError;
import com.psuext.script.execution.model.ScriptTaskSnapshot;
import com.psuext.script.execution.model.ScriptTaskState;
import com.psuext.script.execution.model.ScriptPendingInput;

/** HTTP representation of a live or terminal task snapshot. */
public record ScriptTaskStatusResponse(
        String taskId,
        String name,
        Instant createdAt,
        Instant startedAt,
        Instant endedAt,
        ScriptTaskState state,
        Double progress,
        ScriptTaskError error,
        ScriptPendingInput pendingInput
    ) {

    /** Compatibility constructor for statuses without a pending input request. */
    public ScriptTaskStatusResponse(String taskId, String name, Instant createdAt, Instant startedAt, Instant endedAt,
                                    ScriptTaskState state, Double progress, ScriptTaskError error) {
        this(taskId, name, createdAt, startedAt, endedAt, state, progress, error, null);
    }

    /** Creates an HTTP response from the application snapshot. */
    public static ScriptTaskStatusResponse from(ScriptTaskSnapshot snapshot) {
        return new ScriptTaskStatusResponse(
                snapshot.taskId().toString(), snapshot.name(), snapshot.createdAt(),
                snapshot.startedAt(), snapshot.endedAt(), snapshot.state(),
                snapshot.progress(), snapshot.error(), snapshot.pendingInput());
    }
}
