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

import org.graalvm.polyglot.Value;

/**
 * Provides task cancellation, sleeping, and progress JavaScript host functions.
 */
final class ScriptTaskControlBindings {

    private final ScriptCancellationChecker cancellationChecker;
    private final Duration maximumSleep;
    private final DoubleConsumer progressConsumer;
    private final ScriptInputProvider inputProvider;

    ScriptTaskControlBindings(
            ScriptCancellationChecker cancellationChecker,
            Duration maximumSleep,
            DoubleConsumer progressConsumer,
            ScriptInputProvider inputProvider
    ) {
        this.cancellationChecker = Objects.requireNonNull(cancellationChecker, "cancellationChecker must not be null");
        this.maximumSleep = Objects.requireNonNull(maximumSleep, "maximumSleep must not be null");
        this.progressConsumer = Objects.requireNonNull(progressConsumer, "progressConsumer must not be null");
        this.inputProvider = Objects.requireNonNull(inputProvider, "inputProvider must not be null");
    }

    Object sleep(Value[] arguments) {
        checkNotCancelled();
        ScriptBindingArguments.requireCount(arguments, 1, "sleep");
        long milliseconds = ScriptBindingArguments.requireSleepDuration(arguments[0]);
        if (Duration.ofMillis(milliseconds).compareTo(maximumSleep) > 0) {
            throw new IllegalArgumentException("sleep duration exceeds maximum of " + maximumSleep);
        }
        try {
            Thread.sleep(milliseconds);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            checkNotCancelled();
            throw new IllegalStateException("script sleep was interrupted", exception);
        }
        checkNotCancelled();
        return null;
    }

    Object cancelled(Value[] arguments) {
        ScriptBindingArguments.requireCount(arguments, 0, "cancelled");
        return cancellationChecker.isCancelled();
    }

    Object progress(Value[] arguments) {
        checkNotCancelled();
        ScriptBindingArguments.requireCount(arguments, 1, "progress");
        double value = ScriptBindingArguments.requireNumber(arguments[0], "progress value");
        if (value < 0.0 || value > 1.0 || Double.isNaN(value)) {
            throw new IllegalArgumentException("progress value must be between 0.0 and 1.0");
        }
        progressConsumer.accept(value);
        return null;
    }

    Object input(Value[] arguments) {
        checkNotCancelled();
        if (arguments.length != 1 && arguments.length != 2) {
            throw new IllegalArgumentException("input expects 1 or 2 argument(s)");
        }
        String message = ScriptBindingArguments.requireString(arguments[0], "input message");
        long timeoutMillis = arguments.length == 2
                ? ScriptBindingArguments.requirePositiveMilliseconds(arguments[1], "input timeout")
                : Duration.ofMinutes(5).toMillis();
        double value = inputProvider.input(message, timeoutMillis);
        checkNotCancelled();
        return value;
    }

    private void checkNotCancelled() {
        if (cancellationChecker.isCancelled()) {
            throw new IllegalStateException("script task has been cancelled");
        }
    }
}
