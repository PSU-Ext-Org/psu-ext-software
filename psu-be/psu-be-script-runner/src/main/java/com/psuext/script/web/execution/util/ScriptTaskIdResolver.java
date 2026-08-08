package com.psuext.script.web.execution.util;

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

import java.util.UUID;

import com.psuext.script.execution.model.ScriptTaskId;
import org.springframework.stereotype.Component;

/**
 * Parses script task identifiers at the HTTP boundary.
 */
@Component
public final class ScriptTaskIdResolver {

    /**
     * Parses a task id from a path value.
     *
     * @param value path value
     * @return validated task id
     */
    public ScriptTaskId resolve(String value) {
        try {
            return new ScriptTaskId(UUID.fromString(value));
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException("taskId must be a UUID", exception);
        }
    }
}
