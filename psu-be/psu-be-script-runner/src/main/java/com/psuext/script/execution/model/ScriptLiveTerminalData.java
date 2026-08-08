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

import java.util.Objects;

/** Payload for a terminal task lifecycle event. */
public record ScriptLiveTerminalData(
        ScriptTaskState state,
        ScriptTaskResultSummary result,
        ScriptTaskError error
) implements ScriptLiveEventData {

    public ScriptLiveTerminalData {
        Objects.requireNonNull(state, "state must not be null");
        if (!state.isTerminal()) {
            throw new IllegalArgumentException("state must be terminal");
        }
        if (state == ScriptTaskState.COMPLETED && error != null) {
            throw new IllegalArgumentException("completed event must not have an error");
        }
        if (state != ScriptTaskState.COMPLETED && error == null) {
            throw new IllegalArgumentException("non-completed event must have an error");
        }
    }
}
