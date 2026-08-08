package com.psuext.script.web.execution.handler;

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
 * Identifies a missing script HTTP resource with its stable API error code.
 */
public final class ScriptResourceNotFoundException extends RuntimeException {

    private final String code;

    /**
     * Creates a missing-resource error.
     *
     * @param code stable API error code
     * @param message response message
     */
    public ScriptResourceNotFoundException(String code, String message) {
        super(message);
        this.code = code;
    }

    /** Returns the stable API error code. */
    public String code() {
        return code;
    }
}
