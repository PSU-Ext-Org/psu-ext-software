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

import java.util.Objects;
import java.util.regex.Pattern;

/**
 * Stable, filesystem-safe identifier for a script definition.
 *
 * <p>The lower-case ASCII rule makes the same value safe in URLs, direct child-directory names, and builtin
 * resource filenames. It is intentionally stricter than a generic user-visible name.</p>
 */
public record ScriptDefinitionId(String value) {

    private static final Pattern PATTERN = Pattern.compile("[a-z0-9][a-z0-9-]{0,62}");

    /**
     * Validates an identifier that is safe for URLs, filenames, and classpath resource names.
     *
     * @param value lower-case ASCII identifier
     */
    public ScriptDefinitionId {
        Objects.requireNonNull(value, "value must not be null");
        if (!PATTERN.matcher(value).matches()) {
            throw new IllegalArgumentException("script definition ID must match " + PATTERN.pattern());
        }
    }
}
