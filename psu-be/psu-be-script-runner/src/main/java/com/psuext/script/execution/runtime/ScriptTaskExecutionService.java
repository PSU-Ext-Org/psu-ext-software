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

import com.psuext.script.execution.config.ScriptExecutionProperties;
import com.psuext.script.execution.scpi.ScriptScpiGateway;
import org.springframework.stereotype.Service;

/**
 * Creates and executes the task-local JavaScript runtime graph.
 *
 * <p>Each invocation creates a new restricted GraalJS context, bindings, and
 * executor. Task lifecycle, persistence, cancellation requests, and progress
 * storage remain responsibilities of the caller.
 */
@Service
public final class ScriptTaskExecutionService implements ScriptTaskExecutor {

    private final ScriptScpiGateway scpiGateway;
    private final ScriptExecutionProperties executionProperties;

    /**
     * Creates the task-local execution service.
     *
     * @param scpiGateway script-facing SCPI gateway
     * @param executionProperties host-function limits
     */
    public ScriptTaskExecutionService(
            ScriptScpiGateway scpiGateway,
            ScriptExecutionProperties executionProperties
    ) {
        this.scpiGateway = Objects.requireNonNull(scpiGateway, "scpiGateway must not be null");
        this.executionProperties = Objects.requireNonNull(
                executionProperties,
                "executionProperties must not be null");
    }

    /**
     * Executes source in a new restricted JavaScript runtime.
     *
     * @param request typed task-local execution inputs
     * @return execution value or a structured script error
     */
    @Override
    public ScriptExecutionResult execute(ScriptTaskExecutionRequest request) {
        ScriptBindings bindings = new ScriptBindings(
                scpiGateway,
                request.resultCapture(),
                request.cancellationChecker(),
                new ScriptScalarResponseParser(),
                executionProperties.getMaximumSleep(),
                request.progressConsumer(),
                request.inputProvider()
        );

        ScriptExecutor executor = new ScriptExecutor(
                new RestrictedGraalJsContextFactory(),
                bindings
        );

        return executor.execute(request.source());
    }
}
