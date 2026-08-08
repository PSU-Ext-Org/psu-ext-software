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
import java.util.Objects;

/**
 * Immutable page returned by a script catalogue search.
 *
 * <p>{@code total} is the matching count before the offset and limit are applied, allowing callers to navigate
 * without issuing a separate count query.</p>
 */
public record ScriptDefinitionPage(List<ScriptDefinition> items, int limit, int offset, long total) {

    /** Ensures page metadata is internally consistent and defensively copies the returned items. */
    public ScriptDefinitionPage {
        items = List.copyOf(Objects.requireNonNull(items, "items must not be null"));
        if (limit <= 0 || offset < 0 || total < 0 || items.size() > limit) {
            throw new IllegalArgumentException("invalid script definition page");
        }
    }
}
