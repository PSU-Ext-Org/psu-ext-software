package com.psuext.script.execution.scpi;

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

/**
 * Script-visible SCPI failure raised by the script SCPI gateway.
 */
public class ScriptScpiException extends RuntimeException {

    private final String code;

    /**
     * Creates a script SCPI exception.
     *
     * @param code stable error code
     * @param message readable error message
     */
    public ScriptScpiException(String code, String message) {
        super(message);
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("code must not be blank");
        }
        this.code = code.trim();
    }

    /**
     * Returns the stable script-visible error code.
     *
     * @return error code
     */
    public String code() {
        return code;
    }
}
