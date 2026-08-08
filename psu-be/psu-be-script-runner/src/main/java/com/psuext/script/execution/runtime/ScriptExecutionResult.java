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

import com.psuext.script.execution.model.ScriptTaskError;

/**
 * Outcome of one JavaScript execution.
 *
 * @param returnValue script return value, or {@code null}
 * @param error script failure, or {@code null} when execution succeeded
 */
public record ScriptExecutionResult(Object returnValue, ScriptTaskError error) {

    /**
     * Reports whether execution completed without an error.
     *
     * @return {@code true} when no error was captured
     */
    public boolean succeeded() {
        return error == null;
    }
}
