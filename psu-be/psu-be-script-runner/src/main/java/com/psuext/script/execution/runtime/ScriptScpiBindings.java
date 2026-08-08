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

import java.util.Base64;
import java.util.Objects;

import com.psuext.script.execution.scpi.ScriptScpiGateway;
import org.graalvm.polyglot.Value;

/**
 * Provides the SCPI JavaScript host functions for one task execution.
 */
final class ScriptScpiBindings {

    private final ScriptScpiGateway scpiGateway;
    private final ScriptCancellationChecker cancellationChecker;
    private final ScriptScalarResponseParser responseParser;

    ScriptScpiBindings(
            ScriptScpiGateway scpiGateway,
            ScriptCancellationChecker cancellationChecker,
            ScriptScalarResponseParser responseParser
    ) {
        this.scpiGateway = Objects.requireNonNull(scpiGateway, "scpiGateway must not be null");
        this.cancellationChecker = Objects.requireNonNull(cancellationChecker, "cancellationChecker must not be null");
        this.responseParser = Objects.requireNonNull(responseParser, "responseParser must not be null");
    }

    Object query(Value[] arguments) {
        checkNotCancelled();
        ScpiRequest request = requireRequest(arguments, "query");
        return responseParser.parse(scpiGateway.queryText(request.device(), request.command()));
    }

    Object queryRaw(Value[] arguments) {
        checkNotCancelled();
        ScpiRequest request = requireRequest(arguments, "queryRaw");
        return responseParser.parseRaw(scpiGateway.queryText(request.device(), request.command()));
    }

    Object queryBinary(Value[] arguments) {
        checkNotCancelled();
        ScpiRequest request = requireRequest(arguments, "queryBinary");
        return Base64.getEncoder().encodeToString(scpiGateway.queryBinary(request.device(), request.command()));
    }

    Object write(Value[] arguments) {
        checkNotCancelled();
        ScpiRequest request = requireRequest(arguments, "write");
        scpiGateway.write(request.device(), request.command());
        return null;
    }

    private ScpiRequest requireRequest(Value[] arguments, String function) {
        ScriptBindingArguments.requireCount(arguments, 2, function);
        return new ScpiRequest(
                ScriptBindingArguments.requireString(arguments[0], function + " device"),
                ScriptBindingArguments.requireString(arguments[1], function + " command"));
    }

    private void checkNotCancelled() {
        if (cancellationChecker.isCancelled()) {
            throw new IllegalStateException("script task has been cancelled");
        }
    }

    private record ScpiRequest(String device, String command) {
    }
}
