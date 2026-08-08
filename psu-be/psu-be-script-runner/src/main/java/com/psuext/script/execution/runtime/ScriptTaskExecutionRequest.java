package com.psuext.script.execution.runtime;

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
import java.util.function.DoubleConsumer;

import com.psuext.script.execution.result.ScriptResultEventCaptureService;

/**
 * Task-local inputs required to execute one script.
 *
 * @param source JavaScript source
 * @param resultCapture task-local host callback capture service
 * @param cancellationChecker task-local cancellation state checker
 * @param progressConsumer task-local progress updater
 * @param inputProvider task-local operator input provider
 */
public record ScriptTaskExecutionRequest(
        String source,
        ScriptResultEventCaptureService resultCapture,
        ScriptCancellationChecker cancellationChecker,
        DoubleConsumer progressConsumer,
        ScriptInputProvider inputProvider
) {

    /** Compatibility constructor for execution paths that do not provide operator input. */
    public ScriptTaskExecutionRequest(
            String source, ScriptResultEventCaptureService resultCapture,
            ScriptCancellationChecker cancellationChecker, DoubleConsumer progressConsumer) {
        this(source, resultCapture, cancellationChecker, progressConsumer, ScriptInputProvider.unavailable());
    }

    /** Validates that all execution collaborators are available. */
    public ScriptTaskExecutionRequest {
        Objects.requireNonNull(source, "source must not be null");
        Objects.requireNonNull(resultCapture, "resultCapture must not be null");
        Objects.requireNonNull(cancellationChecker, "cancellationChecker must not be null");
        Objects.requireNonNull(progressConsumer, "progressConsumer must not be null");
        Objects.requireNonNull(inputProvider, "inputProvider must not be null");
    }
}
