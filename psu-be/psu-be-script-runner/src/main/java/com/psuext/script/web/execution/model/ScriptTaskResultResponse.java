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
import java.util.List;
import java.util.Map;

import com.psuext.script.execution.model.ScriptTaskError;
import com.psuext.script.execution.model.ScriptTaskResult;
import com.psuext.script.execution.model.ScriptTaskState;
import com.psuext.script.execution.model.TimeValueSeries;

/** HTTP representation of a terminal script result. */
public record ScriptTaskResultResponse(
        String taskId,
        String name,
        Instant createdAt,
        Instant startedAt,
        Instant endedAt,
        ScriptTaskState finalStatus,
        Double finalProgress,
        Object returnValue,
        ScriptTaskError error,
        List<TimeValueSeries> series,
        Map<String, Object> metadata) {

    /** Creates an HTTP response from the stored result. */
    public static ScriptTaskResultResponse from(ScriptTaskResult result) {
        return new ScriptTaskResultResponse(
                result.taskId().toString(), result.name(), result.createdAt(),
                result.startedAt(), result.endedAt(), result.finalStatus(),
                result.finalProgress(), result.returnValue(), result.error(),
                result.series(), result.metadata());
    }
}
