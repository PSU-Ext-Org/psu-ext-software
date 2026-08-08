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

/** Supplies one operator-provided numeric value to a running script. */
@FunctionalInterface
public interface ScriptInputProvider {

    /**
     * Waits for an operator response.
     *
     * @param message prompt text
     * @param timeoutMillis maximum wait in milliseconds
     * @return supplied value, or the configured Continue value
     */
    double input(String message, long timeoutMillis);

    /** Provider used by test-only or legacy construction paths that do not support operator input. */
    static ScriptInputProvider unavailable() {
        return (message, timeoutMillis) -> {
            throw new IllegalStateException("operator input is unavailable for this script task");
        };
    }
}
