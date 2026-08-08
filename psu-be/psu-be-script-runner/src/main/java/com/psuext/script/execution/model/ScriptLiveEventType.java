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

/** Event kinds emitted while a script task is running. */
public enum ScriptLiveEventType {
    STARTED,
    INPUT_REQUESTED,
    INPUT_RESOLVED,
    CANCELLING,
    LOG,
    RECORD,
    PROGRESS,
    COMPLETED,
    FAILED,
    CANCELLED,
    TIMED_OUT;

    /**
     * Returns whether this event ends the task event stream.
     *
     * @return whether this is a terminal event type
     */
    public boolean isTerminal() {
        return this == COMPLETED
                || this == FAILED
                || this == CANCELLED
                || this == TIMED_OUT;
    }
}
