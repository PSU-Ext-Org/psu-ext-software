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

import java.time.Duration;
import java.util.Objects;
import java.util.function.DoubleConsumer;

import com.psuext.script.execution.result.ScriptResultEventCaptureService;
import com.psuext.script.execution.scpi.ScriptScpiGateway;
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.proxy.ProxyExecutable;

/**
 * Installs the restricted host functions exposed to one script execution.
 *
 * <p>The individual binding collaborators own their respective JavaScript
 * function contracts. This class only composes and installs them.</p>
 */
public final class ScriptBindings {

    private final ScriptScpiBindings scpiBindings;
    private final ScriptTaskControlBindings taskControlBindings;
    private final ScriptResultBindings resultBindings;

    /**
     * Creates task-local script bindings.
     *
     * @param scpiGateway narrow SCPI gateway
     * @param resultCapture task-local result capture service
     * @param cancellationChecker cancellation state checker
     * @param responseParser scalar response parser
     * @param maximumSleep maximum duration accepted by {@code sleep(...) }
     * @param progressConsumer task progress updater
     */
    public ScriptBindings(
            ScriptScpiGateway scpiGateway,
            ScriptResultEventCaptureService resultCapture,
            ScriptCancellationChecker cancellationChecker,
            ScriptScalarResponseParser responseParser,
            Duration maximumSleep,
            DoubleConsumer progressConsumer
    ) {
        this(scpiGateway, resultCapture, cancellationChecker, responseParser, maximumSleep, progressConsumer,
                ScriptInputProvider.unavailable());
    }

    /**
     * Creates task-local bindings including the operator input host function.
     */
    public ScriptBindings(
            ScriptScpiGateway scpiGateway,
            ScriptResultEventCaptureService resultCapture,
            ScriptCancellationChecker cancellationChecker,
            ScriptScalarResponseParser responseParser,
            Duration maximumSleep,
            DoubleConsumer progressConsumer,
            ScriptInputProvider inputProvider
    ) {
        ScriptCancellationChecker checkedCancellationChecker = Objects.requireNonNull(
                cancellationChecker,
                "cancellationChecker must not be null");
        this.scpiBindings = new ScriptScpiBindings(
                Objects.requireNonNull(scpiGateway, "scpiGateway must not be null"),
                checkedCancellationChecker,
                Objects.requireNonNull(responseParser, "responseParser must not be null"));
        this.taskControlBindings = new ScriptTaskControlBindings(
                checkedCancellationChecker,
                Objects.requireNonNull(maximumSleep, "maximumSleep must not be null"),
                Objects.requireNonNull(progressConsumer, "progressConsumer must not be null"),
                Objects.requireNonNull(inputProvider, "inputProvider must not be null"));
        this.resultBindings = new ScriptResultBindings(
                checkedCancellationChecker,
                Objects.requireNonNull(resultCapture, "resultCapture must not be null"));
    }

    /**
     * Installs the script functions in the JavaScript bindings object.
     *
     * @param context restricted context for the current task
     */
    public void install(Context context) {
        Context checkedContext = Objects.requireNonNull(context, "context must not be null");
        for (ScriptBindingCatalogue.ScriptBindingDefinition definition : ScriptBindingCatalogue.definitions()) {
            checkedContext.getBindings("js").putMember(definition.name(), executable(definition.name()));
        }
    }

    private ProxyExecutable executable(String name) {
        return switch (name) {
            case "query" -> scpiBindings::query;
            case "queryRaw" -> scpiBindings::queryRaw;
            case "queryBinary" -> scpiBindings::queryBinary;
            case "write" -> scpiBindings::write;
            case "sleep" -> taskControlBindings::sleep;
            case "input" -> taskControlBindings::input;
            case "cancelled" -> taskControlBindings::cancelled;
            case "progress" -> taskControlBindings::progress;
            case "log" -> resultBindings::log;
            case "record" -> resultBindings::record;
            default -> throw new IllegalStateException("Unsupported script binding " + name);
        };
    }
}
