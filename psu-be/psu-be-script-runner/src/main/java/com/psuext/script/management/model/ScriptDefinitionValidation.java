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

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Pattern;

/** Internal validation rules shared by immutable script-definition models. */
final class ScriptDefinitionValidation {

    static final int MAXIMUM_NAME_LENGTH = 120;
    static final int MAXIMUM_TAG_COUNT = 10;
    private static final Pattern TAG_PATTERN = Pattern.compile("[a-z][a-z0-9-]{0,31}");
    private static final String OUTER_COMMENTS_OR_WHITESPACE =
            "(?:\\s+|//[^\\r\\n]*(?:\\r?\\n|$)|/\\*[\\s\\S]*?\\*/)*";
    private static final Pattern WRAPPED_SOURCE_PATTERN = Pattern.compile(
            "^" + OUTER_COMMENTS_OR_WHITESPACE
                    + "\\(\\s*\\(\\s*\\)\\s*=>\\s*\\{[\\s\\S]*}\\s*\\)\\s*\\(\\s*\\)\\s*;?"
                    + OUTER_COMMENTS_OR_WHITESPACE + "$");

    private ScriptDefinitionValidation() {
    }

    static String name(String value) {
        Objects.requireNonNull(value, "name must not be null");
        var normalized = value.trim();
        if (normalized.isEmpty() || normalized.length() > MAXIMUM_NAME_LENGTH || containsControl(normalized)) {
            throw new IllegalArgumentException("name must be non-blank, printable, and at most 120 characters");
        }
        return normalized;
    }

    static String sourceCode(String value) {
        Objects.requireNonNull(value, "sourceCode must not be null");
        if (value.isBlank()) {
            throw new IllegalArgumentException("sourceCode must not be blank");
        }
        if (!WRAPPED_SOURCE_PATTERN.matcher(value).matches()) {
            throw new IllegalArgumentException("sourceCode must use the (() => { … })(); wrapper, with comments only outside it");
        }
        return value;
    }

    static List<String> tags(Collection<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        if (values.size() > MAXIMUM_TAG_COUNT) {
            throw new IllegalArgumentException("a script definition may have at most 10 tags");
        }

        var normalized = new ArrayList<String>(values.size());
        for (String value : values) {
            Objects.requireNonNull(value, "tag must not be null");
            var tag = value.trim().toLowerCase(Locale.ROOT);
            if (!TAG_PATTERN.matcher(tag).matches()) {
                throw new IllegalArgumentException("tag must match " + TAG_PATTERN.pattern());
            }
            if (normalized.contains(tag)) {
                throw new IllegalArgumentException("duplicate tag: " + tag);
            }
            normalized.add(tag);
        }
        normalized.sort(Comparator.naturalOrder());
        return List.copyOf(normalized);
    }

    private static boolean containsControl(String value) {
        return value.codePoints().anyMatch(Character::isISOControl);
    }
}
