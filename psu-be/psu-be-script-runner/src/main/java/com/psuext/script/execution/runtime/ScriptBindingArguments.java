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

import java.time.Instant;
import java.util.Locale;

import com.psuext.script.execution.model.ScriptResultEventLevel;
import org.graalvm.polyglot.Value;

/**
 * Validates and converts JavaScript host-function arguments at the GraalJS boundary.
 */
final class ScriptBindingArguments {

    private ScriptBindingArguments() {
    }

    static void requireCount(Value[] arguments, int expected, String function) {
        if (arguments.length != expected) {
            throw new IllegalArgumentException(function + " expects " + expected + " argument(s)");
        }
    }

    static String requireString(Value value, String name) {
        if (!value.isString()) {
            throw new IllegalArgumentException(name + " must be a string");
        }
        String text = value.asString();
        if (text.isBlank()) {
            throw new IllegalArgumentException(name + " must not be blank");
        }
        return text;
    }

    static double requireNumber(Value value, String name) {
        if (!value.fitsInDouble()) {
            throw new IllegalArgumentException(name + " must be numeric");
        }
        return value.asDouble();
    }

    static long requireSleepDuration(Value value) {
        if (!value.fitsInLong()) {
            throw new IllegalArgumentException("sleep duration must be an integer number of milliseconds");
        }
        long milliseconds = value.asLong();
        if (milliseconds < 0) {
            throw new IllegalArgumentException("sleep duration must not be negative");
        }
        return milliseconds;
    }

    static long requirePositiveMilliseconds(Value value, String name) {
        if (!value.fitsInLong()) {
            throw new IllegalArgumentException(name + " must be an integer number of milliseconds");
        }
        long milliseconds = value.asLong();
        if (milliseconds <= 0) {
            throw new IllegalArgumentException(name + " must be positive");
        }
        return milliseconds;
    }

    static Instant requireDate(Value value) {
        if (!value.isDate() || !value.canInvokeMember("getTime")) {
            throw new IllegalArgumentException("record date must be a JavaScript Date");
        }
        Value milliseconds = value.invokeMember("getTime");
        if (!milliseconds.fitsInLong()) {
            throw new IllegalArgumentException("record date must be valid");
        }
        return Instant.ofEpochMilli(milliseconds.asLong());
    }

    static ScriptResultEventLevel requireLogLevel(Value value) {
        String text = requireString(value, "log level");
        try {
            return ScriptResultEventLevel.valueOf(text.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("log level must be DEBUG, INFO, WARN, or ERROR", exception);
        }
    }
}
