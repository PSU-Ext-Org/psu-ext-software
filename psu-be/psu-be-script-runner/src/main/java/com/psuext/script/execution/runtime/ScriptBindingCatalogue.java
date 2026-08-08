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

import java.util.List;

/**
 * Stable metadata for every JavaScript host function installed by {@link ScriptBindings}.
 */
public final class ScriptBindingCatalogue {

    private static final List<ScriptBindingDefinition> DEFINITIONS = List.of(
            new ScriptBindingDefinition("query", "query(device, command)", "query(${1:device}, ${2:command})",
                    "Sends a SCPI query and returns a parsed scalar response."),
            new ScriptBindingDefinition("queryRaw", "queryRaw(device, command)", "queryRaw(${1:device}, ${2:command})",
                    "Sends a SCPI query and returns its raw text response."),
            new ScriptBindingDefinition("queryBinary", "queryBinary(device, command)", "queryBinary(${1:device}, ${2:command})",
                    "Sends a binary SCPI query and returns Base64 text."),
            new ScriptBindingDefinition("write", "write(device, command)", "write(${1:device}, ${2:command})",
                    "Sends a SCPI command without waiting for a response."),
            new ScriptBindingDefinition("sleep", "sleep(milliseconds)", "sleep(${1:milliseconds})",
                    "Pauses the task for the requested number of milliseconds."),
            new ScriptBindingDefinition("input", "input(message, timeoutMs)", "input(${1:message}, ${2:timeoutMs})",
                    "Waits for operator input and returns a number. Continue or timeout returns 1; timeout defaults to 300000 ms."),
            new ScriptBindingDefinition("cancelled", "cancelled()", "cancelled()",
                    "Returns whether cancellation has been requested for this task."),
            new ScriptBindingDefinition("progress", "progress(value)", "progress(${1:value})",
                    "Updates task progress with a value from 0.0 to 1.0."),
            new ScriptBindingDefinition("log", "log(level, message)", "log(${1:level}, ${2:message})",
                    "Adds a task log event. Level is TRACE, DEBUG, INFO, WARN, or ERROR."),
            new ScriptBindingDefinition("record", "record(timestamp, series, unit, value)",
                    "record(${1:timestamp}, ${2:series}, ${3:unit}, ${4:value})",
                    "Adds a timestamped numeric result record."));

    private ScriptBindingCatalogue() {
    }

    /** @return metadata for every supported script host function, in completion order */
    public static List<ScriptBindingDefinition> definitions() {
        return DEFINITIONS;
    }

    /** Immutable script host-function metadata. */
    public record ScriptBindingDefinition(String name, String signature, String snippet, String documentation) {
    }
}
