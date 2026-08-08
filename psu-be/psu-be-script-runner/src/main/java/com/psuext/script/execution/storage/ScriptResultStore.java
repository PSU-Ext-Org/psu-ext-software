package com.psuext.script.execution.storage;

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
import java.util.Optional;

import com.psuext.script.execution.model.ScriptResultQuery;
import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.model.ScriptTaskResult;
import com.psuext.script.execution.model.ScriptTaskResultSummary;

/**
 * Storage boundary for terminal script task results.
 */
public interface ScriptResultStore {

    /**
     * Saves or replaces one terminal task result.
     *
     * @param result result to save
     */
    void save(ScriptTaskResult result);

    /**
     * Finds one stored result by id.
     *
     * @param taskId task id
     * @return stored result, if present
     */
    Optional<ScriptTaskResult> findById(ScriptTaskId taskId);

    /**
     * Opens one stored series for a bounded streaming read.
     *
     * @param taskId task id
     * @param seriesName series name
     * @param range requested point range
     * @return streaming series read when the series exists
     */
    default Optional<ScriptTaskSeriesRead> openSeries(
            ScriptTaskId taskId, String seriesName, ScriptSeriesRange range) {
        return Optional.empty();
    }

    /**
     * Lists stored result summaries.
     *
     * @param query list query
     * @return matching summaries
     */
    List<ScriptTaskResultSummary> list(ScriptResultQuery query);

    /**
     * Deletes one stored result.
     *
     * @param taskId task id
     */
    void delete(ScriptTaskId taskId);
}
