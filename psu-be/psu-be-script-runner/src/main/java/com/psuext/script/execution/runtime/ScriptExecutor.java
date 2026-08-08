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

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.TimeUnit;

import com.psuext.script.execution.model.ScriptTaskError;
import com.psuext.script.execution.scpi.ScriptScpiException;
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.PolyglotException;
import org.graalvm.polyglot.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Executes one source string in a restricted task-local GraalJS context.
 */
public final class ScriptExecutor {

    private static final Logger LOGGER = LoggerFactory.getLogger(ScriptExecutor.class);
    private final RestrictedGraalJsContextFactory contextFactory;
    private final ScriptBindings bindings;

    /**
     * Creates an executor for one task-local binding graph.
     *
     * @param contextFactory restricted context factory
     * @param bindings task-local host bindings
     */
    public ScriptExecutor(
            RestrictedGraalJsContextFactory contextFactory,
            ScriptBindings bindings
    ) {
        this.contextFactory = Objects.requireNonNull(contextFactory, "contextFactory must not be null");
        this.bindings = Objects.requireNonNull(bindings, "bindings must not be null");
    }

    /**
     * Executes source with top-level return enabled.
     *
     * @param source JavaScript source
     * @return execution value or a structured script error
     */
    public ScriptExecutionResult execute(String source) {
        if (source == null || source.isBlank()) {
            ScriptExecutionResult result = new ScriptExecutionResult(
                    null,
                    new ScriptTaskError("SCRIPT_SOURCE_INVALID", "script source must not be blank", "SCRIPT", null));
            LOGGER.warn("Script execution rejected: errorCode={}", result.error().code());
            return result;
        }

        long startedAt = System.nanoTime();
        LOGGER.debug("Script execution started: sourceLength={}", source.length());
        try (Context context = contextFactory.create()) {
            bindings.install(context);
            Value result = context.eval("js", source);
            ScriptExecutionResult executionResult = new ScriptExecutionResult(readReturnValue(result, 0), null);
            LOGGER.debug("Script execution completed: durationMs={}", elapsedMillis(startedAt));
            return executionResult;
        } catch (RuntimeException exception) {
            ScriptTaskError error = toTaskError(exception);
            LOGGER.warn("Script execution failed: errorCode={} source={}", error.code(), error.source());
            return new ScriptExecutionResult(null, error);
        }
    }

    private static long elapsedMillis(long startedAt) {
        return TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt);
    }

    private Object readReturnValue(Value value, int depth) {
        if (value == null || value.isNull()) {
            return null;
        }
        if (value.isBoolean()) {
            return value.asBoolean();
        }
        if (value.isString()) {
            return value.asString();
        }
        if (value.fitsInLong()) {
            return value.asLong();
        }
        if (value.fitsInDouble()) {
            return value.asDouble();
        }
        if (depth >= 32) {
            return value.toString();
        }
        if (value.hasArrayElements()) {
            List<Object> values = new ArrayList<>();
            for (long index = 0; index < value.getArraySize(); index++) {
                values.add(readReturnValue(value.getArrayElement(index), depth + 1));
            }
            return values;
        }
        if (value.hasMembers()) {
            Map<String, Object> values = new LinkedHashMap<>();
            for (String key : value.getMemberKeys()) {
                values.put(key, readReturnValue(value.getMember(key), depth + 1));
            }
            return values;
        }
        return value.toString();
    }

    private static ScriptTaskError toTaskError(Throwable exception) {

        Throwable cause = unwrap(exception);

        if (cause instanceof ScriptScpiException scpiException) {
            return new ScriptTaskError(scpiException.code(), scpiException.getMessage(), "SCPI", null);
        }

        if (cause instanceof IllegalStateException
                && "script task has been cancelled".equals(cause.getMessage())) {
            return new ScriptTaskError("SCRIPT_CANCELLED", cause.getMessage(), "CANCELLATION", null);
        }

        String message = cause.getMessage() == null || cause.getMessage().isBlank()
                ? "script execution failed"
                : cause.getMessage();

        return new ScriptTaskError("SCRIPT_EXECUTION_FAILED", message, "SCRIPT", null);
    }

    private static Throwable unwrap(Throwable exception) {
        if (exception instanceof PolyglotException polyglotException
                && polyglotException.isHostException()) {
            return polyglotException.asHostException();
        }
        return exception;
    }
}
