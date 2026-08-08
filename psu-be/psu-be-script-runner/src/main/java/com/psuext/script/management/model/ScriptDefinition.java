package com.psuext.script.management.model;

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

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/**
 * Immutable, validated saved JavaScript definition.
 *
 * <p>This is the domain representation shared by catalogue implementations and future adapters. It deliberately
 * contains no filesystem, classpath, web, or execution-task state. Collection fields are copied so callers cannot
 * mutate a returned definition.</p>
 */
public record ScriptDefinition(
        ScriptDefinitionId id,
        String name,
        String sourceCode,
        List<String> tags,
        ScriptDefinitionOrigin origin,
        Instant createdAt,
        Instant updatedAt,
        Integer position
) {
    /** Compatibility constructor for user definitions and callers without display-position metadata. */
    public ScriptDefinition(
            ScriptDefinitionId id,
            String name,
            String sourceCode,
            List<String> tags,
            ScriptDefinitionOrigin origin,
            Instant createdAt,
            Instant updatedAt
    ) {
        this(id, name, sourceCode, tags, origin, createdAt, updatedAt, null);
    }

    /**
     * Validates and normalizes the complete definition state.
     *
     * <p>The update timestamp may equal the creation timestamp but can never precede it.</p>
     */
    public ScriptDefinition {
        Objects.requireNonNull(id, "id must not be null");
        Objects.requireNonNull(origin, "origin must not be null");
        Objects.requireNonNull(createdAt, "createdAt must not be null");
        Objects.requireNonNull(updatedAt, "updatedAt must not be null");

        name = ScriptDefinitionValidation.name(name);
        sourceCode = ScriptDefinitionValidation.sourceCode(sourceCode);
        tags = ScriptDefinitionValidation.tags(tags);

        if (updatedAt.isBefore(createdAt)) {
            throw new IllegalArgumentException("updatedAt must not be before createdAt");
        }
    }
}
