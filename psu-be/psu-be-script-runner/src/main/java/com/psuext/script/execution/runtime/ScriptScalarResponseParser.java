package com.psuext.script.execution.runtime;

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

/**
 * Parses the scalar text response returned by the script SCPI query binding.
 */
public final class ScriptScalarResponseParser {

    /**
     * Parses a trimmed response as a JavaScript-compatible scalar.
     *
     * @param response raw SCPI response
     * @return a {@link Double} for a numeric response, otherwise a trimmed string
     */
    public Object parse(String response) {
        String trimmed = Objects.requireNonNull(response, "response must not be null").trim();
        try {
            return Double.parseDouble(trimmed);
        } catch (NumberFormatException ignored) {
            return trimmed;
        }
    }

    /**
     * Trims a raw SCPI response without scalar conversion.
     *
     * @param response raw SCPI response
     * @return trimmed response
     */
    public String parseRaw(String response) {
        return Objects.requireNonNull(response, "response must not be null").trim();
    }
}
