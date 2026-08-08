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

import java.time.Duration;

/**
 * Request to start one JavaScript script task.
 *
 * @param name human-readable task name, or a generated default when blank
 * @param source JavaScript source to execute
 * @param timeout maximum task runtime
 */
public record ScriptStartRequest(
        String name,
        String source,
        Duration timeout
) {

    /**
     * Default maximum runtime used when a request does not provide a timeout.
     */
    public static final Duration DEFAULT_TIMEOUT = Duration.ofMinutes(70);

    public ScriptStartRequest {
        if (source == null || source.isBlank()) {
            throw new IllegalArgumentException("source must not be blank");
        }
        if (name == null || name.isBlank()) {
            name = "Untitled script";
        } else {
            name = name.trim();
        }
        if (timeout == null) {
            timeout = DEFAULT_TIMEOUT;
        } else if (timeout.isZero() || timeout.isNegative()) {
            throw new IllegalArgumentException("timeout must be positive");
        }
    }
}
