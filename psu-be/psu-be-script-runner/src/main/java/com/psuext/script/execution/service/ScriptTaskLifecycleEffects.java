package com.psuext.script.execution.service;

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

import com.psuext.script.execution.model.ScriptLiveProgressData;
import com.psuext.script.execution.model.ScriptLiveTaskStateData;
import com.psuext.script.execution.model.ScriptLiveTerminalData;
import com.psuext.script.execution.model.ScriptLiveInputData;
import com.psuext.script.execution.model.ScriptPendingInput;
import com.psuext.script.execution.model.ScriptLiveEventType;
import com.psuext.script.execution.model.ScriptResultEventLevel;
import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.model.ScriptTaskResult;
import com.psuext.script.execution.model.ScriptTaskResultSummary;
import com.psuext.script.execution.model.ScriptTaskState;
import com.psuext.script.execution.result.ScriptLiveEventPublisher;
import com.psuext.script.execution.result.ScriptTaskResultAssembler;
import com.psuext.script.execution.storage.ScriptTaskLogWriter;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Performs result assembly, log lifecycle, and live-event publication after
 * task state transitions.
 */
@Component
public final class ScriptTaskLifecycleEffects {

    private static final Logger LOGGER = LoggerFactory.getLogger(ScriptTaskLifecycleEffects.class);
    private final ScriptLiveEventPublisher liveEventPublisher;

    ScriptTaskLifecycleEffects(ScriptLiveEventPublisher liveEventPublisher) {
        this.liveEventPublisher = Objects.requireNonNull(liveEventPublisher, "liveEventPublisher must not be null");
    }

    void started(RunningScriptTask task, ScriptTaskResultAssembler assembler, Instant timestamp) {
        assembler.started(timestamp);
        liveEventPublisher.publish(task.taskId(), timestamp, ScriptLiveEventType.STARTED,
                new ScriptLiveTaskStateData(task.snapshot().state(), null));
    }

    void cancelling(ScriptTaskId taskId, Instant timestamp) {
        liveEventPublisher.publish(taskId, timestamp, ScriptLiveEventType.CANCELLING,
                new ScriptLiveTaskStateData(ScriptTaskState.CANCELLING, null));
    }

    void progress(RunningScriptTask task, double value, Instant timestamp) {
        liveEventPublisher.publish(task.taskId(), timestamp, ScriptLiveEventType.PROGRESS,
                new ScriptLiveProgressData(value));
    }

    void inputRequested(RunningScriptTask task, ScriptPendingInput input, Instant timestamp) {
        liveEventPublisher.publish(task.taskId(), timestamp, ScriptLiveEventType.INPUT_REQUESTED,
                new ScriptLiveInputData(com.psuext.script.execution.model.ScriptTaskState.PENDING_INPUT, input));
    }

    void inputResolved(RunningScriptTask task, ScriptPendingInput input, Instant timestamp) {
        liveEventPublisher.publish(task.taskId(), timestamp, ScriptLiveEventType.INPUT_RESOLVED,
                new ScriptLiveInputData(com.psuext.script.execution.model.ScriptTaskState.RUNNING, input));
    }

    ScriptTaskResult complete(
            RunningScriptTask task,
            ScriptTaskTerminalResult outcome,
            ScriptTaskResultAssembler assembler,
            ScriptTaskLogWriter logWriter) {
        if (outcome.state() == com.psuext.script.execution.model.ScriptTaskState.TIMED_OUT) {
            logWriter.append(outcome.endedAt(), ScriptResultEventLevel.WARN,
                    "Task timed out after " + task.timeout());
        }
        ScriptTaskResult result = assembler.complete(outcome.state(), outcome.progress(), outcome.returnValue(),
                outcome.error(), outcome.endedAt());
        try {
            logWriter.close();
        } finally {
            liveEventPublisher.publish(task.taskId(), outcome.endedAt(), eventType(outcome.state()),
                    new ScriptLiveTerminalData(outcome.state(), ScriptTaskResultSummary.from(result), outcome.error()));
        }
        LOGGER.info("Script task completed: taskId={} state={} durationMs={} errorCode={}",
                task.taskId(), outcome.state(), durationMillis(task, outcome),
                outcome.error() == null ? null : outcome.error().code());
        return result;
    }

    private static Long durationMillis(RunningScriptTask task, ScriptTaskTerminalResult outcome) {
        Instant startedAt = task.snapshot().startedAt();
        return startedAt == null ? null : java.time.Duration.between(startedAt, outcome.endedAt()).toMillis();
    }

    private static ScriptLiveEventType eventType(com.psuext.script.execution.model.ScriptTaskState state) {
        return switch (state) {
            case COMPLETED -> ScriptLiveEventType.COMPLETED;
            case FAILED -> ScriptLiveEventType.FAILED;
            case CANCELLED -> ScriptLiveEventType.CANCELLED;
            case TIMED_OUT -> ScriptLiveEventType.TIMED_OUT;
            case INTERRUPTED -> ScriptLiveEventType.FAILED;
            default -> throw new IllegalArgumentException("state must be terminal: " + state);
        };
    }
}
