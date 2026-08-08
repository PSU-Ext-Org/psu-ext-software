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

/** Payload published when a script begins or finishes waiting for operator input. */
public record ScriptLiveInputData(ScriptTaskState state, ScriptPendingInput input)
        implements ScriptLiveEventData {

    public ScriptLiveInputData {
        Objects.requireNonNull(state, "state must not be null");
        Objects.requireNonNull(input, "input must not be null");
        if (state != ScriptTaskState.PENDING_INPUT && state != ScriptTaskState.RUNNING) {
            throw new IllegalArgumentException("input event state must be PENDING_INPUT or RUNNING");
        }
    }
}
