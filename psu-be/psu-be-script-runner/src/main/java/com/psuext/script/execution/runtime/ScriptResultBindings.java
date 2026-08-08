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
import java.util.Objects;

import com.psuext.script.execution.model.ScriptLogEventData;
import com.psuext.script.execution.model.ScriptRecordEventData;
import com.psuext.script.execution.result.ScriptResultEventCaptureService;
import org.graalvm.polyglot.Value;

/**
 * Provides typed task-log and result-record JavaScript host functions.
 */
final class ScriptResultBindings {

    private final ScriptCancellationChecker cancellationChecker;
    private final ScriptResultEventCaptureService resultCapture;

    ScriptResultBindings(
            ScriptCancellationChecker cancellationChecker,
            ScriptResultEventCaptureService resultCapture
    ) {
        this.cancellationChecker = Objects.requireNonNull(cancellationChecker, "cancellationChecker must not be null");
        this.resultCapture = Objects.requireNonNull(resultCapture, "resultCapture must not be null");
    }

    Object log(Value[] arguments) {
        checkNotCancelled();
        ScriptBindingArguments.requireCount(arguments, 2, "log");
        ScriptLogEventData data = new ScriptLogEventData(
                ScriptBindingArguments.requireLogLevel(arguments[0]),
                ScriptBindingArguments.requireString(arguments[1], "log message"));
        resultCapture.captureLog(Instant.now(), data.level(), data.message());
        return null;
    }

    Object record(Value[] arguments) {
        checkNotCancelled();
        ScriptBindingArguments.requireCount(arguments, 4, "record");
        ScriptRecordEventData data = new ScriptRecordEventData(
                ScriptBindingArguments.requireDate(arguments[0]),
                ScriptBindingArguments.requireString(arguments[1], "record series"),
                ScriptBindingArguments.requireString(arguments[2], "record unit"),
                ScriptBindingArguments.requireNumber(arguments[3], "record value"));
        resultCapture.captureRecord(Instant.now(), data);
        return null;
    }

    private void checkNotCancelled() {
        if (cancellationChecker.isCancelled()) {
            throw new IllegalStateException("script task has been cancelled");
        }
    }
}
