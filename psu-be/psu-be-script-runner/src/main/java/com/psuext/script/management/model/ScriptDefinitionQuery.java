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

import java.util.List;

/**
 * Validated paging and discovery criteria for a script catalogue.
 *
 * <p>Name search is a case-insensitive substring match. Tag filters require at least one requested tag. Blank
 * name filters are treated as absent; tags are normalized using the same rules as stored definition tags.</p>
 */
public record ScriptDefinitionQuery(int limit, int offset, String name, List<String> tags) {

    /** Validates page bounds and normalizes optional name/tag criteria. */
    public ScriptDefinitionQuery {
        if (limit <= 0 || limit > 500) {
            throw new IllegalArgumentException("limit must be between 1 and 500");
        }
        if (offset < 0) {
            throw new IllegalArgumentException("offset must not be negative");
        }
        name = normalizeNameFilter(name);
        tags = ScriptDefinitionValidation.tags(tags);
    }

    private static String normalizeNameFilter(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return ScriptDefinitionValidation.name(value);
    }
}
