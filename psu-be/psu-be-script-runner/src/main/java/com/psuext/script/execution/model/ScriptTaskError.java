package com.psuext.script.execution.model;

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
 * Stable error description stored with failed, cancelled, or timed-out tasks.
 *
 * @param code stable machine-readable error code
 * @param message human-readable error message
 * @param source error source such as SCRIPT, SCPI, CONNECTION, TRANSPORT, TIMEOUT, CANCELLATION, or RUNTIME
 * @param detail optional sanitized diagnostic detail
 */
public record ScriptTaskError(
        String code,
        String message,
        String source,
        String detail
) {

    public ScriptTaskError {

        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("code must not be blank");
        }
        if (message == null || message.isBlank()) {
            throw new IllegalArgumentException("message must not be blank");
        }
        if (source == null || source.isBlank()) {
            throw new IllegalArgumentException("source must not be blank");
        }

        code = code.trim();
        message = message.trim();
        source = source.trim();
    }
}
