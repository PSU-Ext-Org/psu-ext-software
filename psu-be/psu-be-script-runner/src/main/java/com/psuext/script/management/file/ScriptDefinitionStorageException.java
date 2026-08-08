package com.psuext.script.management.file;

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
 * Signals that a user script definition could not be read or published safely.
 *
 * <p>The exception deliberately carries a stable operational message rather than a filesystem path. Future web
 * exception advice can therefore report a safe storage failure without exposing local deployment details.</p>
 */
public final class ScriptDefinitionStorageException extends RuntimeException {

    /** @param message safe operational description */
    public ScriptDefinitionStorageException(String message) {
        super(message);
    }

    /** @param message safe operational description @param cause underlying filesystem failure */
    public ScriptDefinitionStorageException(String message, Throwable cause) {
        super(message, cause);
    }
}
