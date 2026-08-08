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

import org.jspecify.annotations.NonNull;

import java.util.Objects;
import java.util.UUID;

/**
 * Stable identifier for one script task.
 *
 * @param value underlying UUID value
 */
public record ScriptTaskId(UUID value) {

    public ScriptTaskId {
        Objects.requireNonNull(value, "value must not be null");
    }

    /**
     * Creates a new random script task identifier.
     *
     * @return generated task id
     */
    public static ScriptTaskId random() {
        return new ScriptTaskId(UUID.randomUUID());
    }

    @NonNull
    @Override
    public String toString() {
        return value.toString();
    }
}
