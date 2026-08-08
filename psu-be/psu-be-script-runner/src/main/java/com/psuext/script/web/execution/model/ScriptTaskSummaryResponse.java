package com.psuext.script.web.execution.model;

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

import com.psuext.script.execution.model.ScriptTaskResultSummary;
import com.psuext.script.execution.model.ScriptTaskState;

/** HTTP representation of a terminal result summary. */
public record ScriptTaskSummaryResponse(
        String taskId,
        String name,
        Instant startedAt,
        Instant endedAt,
        ScriptTaskState finalStatus) {

    /** Creates an HTTP response from a stored summary. */
    public static ScriptTaskSummaryResponse from(ScriptTaskResultSummary summary) {
        return new ScriptTaskSummaryResponse(
                summary.taskId().toString(), summary.name(), summary.startedAt(),
                summary.endedAt(), summary.finalStatus());
    }
}
