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

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.Future;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import com.psuext.script.execution.model.ScriptTaskError;
import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.model.ScriptTaskSnapshot;
import com.psuext.script.execution.model.ScriptTaskState;
import com.psuext.script.execution.model.ScriptPendingInput;
import com.psuext.script.execution.runtime.ScriptExecutionResult;

/**
 * Synchronized lifecycle state for one running script.
 *
 * <p>This class has no storage, result-assembly, logging, or event-publication
 * dependencies. Terminal transitions return immutable data for a lifecycle
 * collaborator to process exactly once.</p>
 */
final class RunningScriptTask {

    private final ScriptTaskId taskId;
    private final String name;
    private final String source;
    private final Duration timeout;
    private final Instant createdAt;
    private final AtomicBoolean cancellationRequested = new AtomicBoolean();
    private ScriptTaskState state = ScriptTaskState.QUEUED;
    private Instant startedAt;
    private Instant endedAt;
    private Double progress;
    private ScriptTaskError error;
    private Future<?> future;
    private InputWait inputWait;

    RunningScriptTask(ScriptTaskId taskId, String name, String source, Duration timeout, Instant createdAt) {
        this.taskId = Objects.requireNonNull(taskId, "taskId must not be null");
        this.name = Objects.requireNonNull(name, "name must not be null");
        this.source = Objects.requireNonNull(source, "source must not be null");
        this.timeout = Objects.requireNonNull(timeout, "timeout must not be null");
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt must not be null");
    }

    synchronized void setFuture(Future<?> future) {
        this.future = future;
    }

    synchronized boolean markRunning(Instant timestamp) {
        if (state != ScriptTaskState.QUEUED) {
            return false;
        }
        startedAt = timestamp;
        state = ScriptTaskState.RUNNING;
        return true;
    }

    boolean isCancellationRequested() {
        return cancellationRequested.get();
    }

    String source() {
        return source;
    }

    ScriptTaskId taskId() {
        return taskId;
    }

    Duration timeout() {
        return timeout;
    }

    synchronized boolean cancel() {
        if (state.isTerminal() || state == ScriptTaskState.CANCELLING) {
            return false;
        }
        cancellationRequested.set(true);
        state = ScriptTaskState.CANCELLING;
        cancelInputWait();
        cancelFuture();
        return true;
    }

    synchronized Optional<ScriptTaskTerminalResult> timeout(Instant timestamp) {
        if (state.isTerminal()) {
            return Optional.empty();
        }
        cancellationRequested.set(true);
        cancelInputWait();
        cancelFuture();
        return complete(ScriptTaskState.TIMED_OUT,
                new ScriptTaskError("SCRIPT_TIMEOUT", "script task exceeded its timeout", "TIMEOUT", null),
                null, timestamp);
    }

    synchronized Optional<ScriptTaskTerminalResult> finish(ScriptExecutionResult execution, Instant timestamp) {
        if (state.isTerminal()) {
            return Optional.empty();
        }
        ScriptTaskState finalState = cancellationRequested.get()
                ? ScriptTaskState.CANCELLED
                : execution.succeeded() ? ScriptTaskState.COMPLETED : ScriptTaskState.FAILED;
        ScriptTaskError finalError = finalState == ScriptTaskState.CANCELLED
                ? new ScriptTaskError("SCRIPT_CANCELLED", "script task was cancelled", "CANCELLATION", null)
                : execution.error();
        return complete(finalState, finalError,
                finalState == ScriptTaskState.CANCELLED ? null : execution.returnValue(), timestamp);
    }

    synchronized boolean updateProgress(double value) {
        if (state.isTerminal()) {
            return false;
        }
        progress = value;
        return true;
    }

    synchronized ScriptTaskSnapshot snapshot() {
        return new ScriptTaskSnapshot(taskId, name, createdAt, startedAt, endedAt, state, progress, error,
                inputWait == null ? null : inputWait.input());
    }

    synchronized ScriptPendingInput requestInput(String message, long timeoutMillis, Instant timestamp) {
        if (state != ScriptTaskState.RUNNING) {
            throw new IllegalStateException("script task cannot request input while " + state);
        }
        ScriptPendingInput input = new ScriptPendingInput(UUID.randomUUID().toString(), message,
                timestamp.plusMillis(timeoutMillis));
        inputWait = new InputWait(input);
        state = ScriptTaskState.PENDING_INPUT;
        return input;
    }

    double awaitInput(ScriptPendingInput input) {
        InputWait wait;
        synchronized (this) {
            wait = inputWait;
            if (wait == null || !wait.input().requestId().equals(input.requestId())) {
                throw new IllegalStateException("operator input request is no longer active");
            }
        }
        try {
            long remainingMillis = Math.max(1L, java.time.Duration.between(Instant.now(), input.deadline()).toMillis());
            return wait.response().get(remainingMillis, TimeUnit.MILLISECONDS);
        } catch (TimeoutException exception) {
            if (resolveInput(input.requestId(), 1.0d)) {
                return 1.0d;
            }
            return awaitCompletedInput(wait);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("script task has been cancelled", exception);
        } catch (ExecutionException exception) {
            throw new IllegalStateException("script task has been cancelled", exception.getCause());
        }
    }

    synchronized boolean resolveInput(String requestId, Double suppliedValue) {
        if (state != ScriptTaskState.PENDING_INPUT || inputWait == null
                || !inputWait.input().requestId().equals(requestId)) {
            return false;
        }
        double value = suppliedValue == null ? 1.0d : suppliedValue;
        if (!Double.isFinite(value)) {
            throw new IllegalArgumentException("input value must be a finite number");
        }
        InputWait current = inputWait;
        inputWait = null;
        state = ScriptTaskState.RUNNING;
        current.response().complete(value);
        return true;
    }

    synchronized boolean isCompletedBefore(Instant cutoff) {
        return state.isTerminal() && endedAt != null && endedAt.isBefore(cutoff);
    }

    synchronized boolean isTerminal() {
        return state.isTerminal();
    }

    synchronized Instant endedAt() {
        return endedAt;
    }

    private Optional<ScriptTaskTerminalResult> complete(
            ScriptTaskState finalState, ScriptTaskError finalError, Object returnValue, Instant timestamp) {
        state = finalState;
        cancelInputWait();
        error = finalError;
        endedAt = timestamp;
        return Optional.of(new ScriptTaskTerminalResult(finalState, finalError, returnValue, timestamp, progress));
    }

    private void cancelFuture() {
        if (future != null) {
            future.cancel(true);
        }
    }

    private void cancelInputWait() {
        if (inputWait != null) {
            inputWait.response().completeExceptionally(new java.util.concurrent.CancellationException("task ended"));
            inputWait = null;
        }
    }

    private static double awaitCompletedInput(InputWait wait) {
        try {
            return wait.response().get();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("script task has been cancelled", exception);
        } catch (ExecutionException exception) {
            throw new IllegalStateException("script task has been cancelled", exception.getCause());
        }
    }

    private record InputWait(ScriptPendingInput input, CompletableFuture<Double> response) {
        private InputWait(ScriptPendingInput input) {
            this(input, new CompletableFuture<>());
        }
    }
}
