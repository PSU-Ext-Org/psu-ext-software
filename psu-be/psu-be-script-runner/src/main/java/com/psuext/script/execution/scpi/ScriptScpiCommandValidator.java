package com.psuext.script.execution.scpi;

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
 * Validates script-facing SCPI command intent before transport submission.
 */
public final class ScriptScpiCommandValidator {

    private ScriptScpiCommandValidator() {
    }

    /**
     * Validates a command intended to produce a response.
     *
     * @param command SCPI command without transport line ending
     */
    public static void requireQuery(String command) {
        validateCommon(command);
        if (!firstHeader(command).contains("?")) {
            throw new ScriptScpiException(
                    "INVALID_QUERY_COMMAND",
                    "Query command must contain '?' in the first header");
        }
    }

    /**
     * Validates a command intended to be sent without reading a response.
     *
     * @param command SCPI command without transport line ending
     */
    public static void requireWrite(String command) {
        validateCommon(command);
        if (firstHeader(command).contains("?")) {
            throw new ScriptScpiException(
                    "INVALID_WRITE_COMMAND",
                    "Write command must not contain '?' in the first header");
        }
    }

    /**
     * Validates basic SCPI command shape.
     *
     * @param command SCPI command without transport line ending
     */
    public static void validateCommon(String command) {
        if (command == null || command.isBlank()) {
            throw new ScriptScpiException("INVALID_COMMAND", "SCPI command must not be blank");
        }
        if (command.endsWith("\r") || command.endsWith("\n")) {
            throw new ScriptScpiException("INVALID_COMMAND", "SCPI command must not include a trailing line ending");
        }
    }

    private static String firstHeader(String command) {
        String trimmed = command.stripLeading();
        int whitespace = firstWhitespace(trimmed);
        return whitespace == -1 ? trimmed : trimmed.substring(0, whitespace);
    }

    private static int firstWhitespace(String value) {
        for (int index = 0; index < value.length(); index++) {
            if (Character.isWhitespace(value.charAt(index))) {
                return index;
            }
        }
        return -1;
    }
}
