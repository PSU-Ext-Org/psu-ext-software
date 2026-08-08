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

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

/** Marker interface for typed live-event payloads. */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "dataType")
@JsonSubTypes({
        @JsonSubTypes.Type(value = ScriptLiveLogData.class, name = "log"),
        @JsonSubTypes.Type(value = ScriptLiveRecordData.class, name = "record"),
        @JsonSubTypes.Type(value = ScriptLiveProgressData.class, name = "progress"),
        @JsonSubTypes.Type(value = ScriptLiveInputData.class, name = "input"),
        @JsonSubTypes.Type(value = ScriptLiveTaskStateData.class, name = "taskState"),
        @JsonSubTypes.Type(value = ScriptLiveTerminalData.class, name = "terminal")
})
public sealed interface ScriptLiveEventData
        permits ScriptLiveLogData, ScriptLiveRecordData, ScriptLiveProgressData, ScriptLiveInputData,
        ScriptLiveTaskStateData, ScriptLiveTerminalData {
}
