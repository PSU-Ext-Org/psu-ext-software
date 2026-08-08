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

/** Immutable, ordered notification emitted for one script task. */
public record ScriptLiveEvent(
        ScriptTaskId taskId,
        long sequence,
        Instant timestamp,
        ScriptLiveEventType type,
        ScriptLiveEventData data) {

    public ScriptLiveEvent {
        Objects.requireNonNull(taskId, "taskId must not be null");
        if (sequence < 1) {
            throw new IllegalArgumentException("sequence must be positive");
        }
        Objects.requireNonNull(timestamp, "timestamp must not be null");
        Objects.requireNonNull(type, "type must not be null");
        Objects.requireNonNull(data, "data must not be null");
        validatePayload(type, data);
    }

    private static void validatePayload(ScriptLiveEventType type, ScriptLiveEventData data) {
        boolean valid = switch (type) {
            case STARTED -> data instanceof ScriptLiveTaskStateData stateData
                    && stateData.state() == ScriptTaskState.RUNNING;
            case INPUT_REQUESTED -> data instanceof ScriptLiveInputData inputData
                    && inputData.state() == ScriptTaskState.PENDING_INPUT;
            case INPUT_RESOLVED -> data instanceof ScriptLiveInputData inputData
                    && inputData.state() == ScriptTaskState.RUNNING;
            case CANCELLING -> data instanceof ScriptLiveTaskStateData stateData
                    && stateData.state() == ScriptTaskState.CANCELLING;
            case LOG -> data instanceof ScriptLiveLogData;
            case RECORD -> data instanceof ScriptLiveRecordData;
            case PROGRESS -> data instanceof ScriptLiveProgressData;
            case COMPLETED, FAILED, CANCELLED, TIMED_OUT -> data instanceof ScriptLiveTerminalData terminalData
                    && terminalData.state() == terminalState(type);
        };
        if (!valid) {
            throw new IllegalArgumentException("payload does not match event type: " + type);
        }
    }

    private static ScriptTaskState terminalState(ScriptLiveEventType type) {
        return switch (type) {
            case COMPLETED -> ScriptTaskState.COMPLETED;
            case FAILED -> ScriptTaskState.FAILED;
            case CANCELLED -> ScriptTaskState.CANCELLED;
            case TIMED_OUT -> ScriptTaskState.TIMED_OUT;
            default -> throw new IllegalArgumentException("event type is not terminal: " + type);
        };
    }
}
