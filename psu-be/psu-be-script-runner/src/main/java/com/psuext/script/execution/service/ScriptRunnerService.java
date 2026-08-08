package com.psuext.script.execution.service;

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

import java.util.Optional;

import com.psuext.script.execution.model.ScriptStartRequest;
import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.model.ScriptTaskPage;
import com.psuext.script.execution.model.ScriptTaskQuery;
import com.psuext.script.execution.model.ScriptTaskResult;
import com.psuext.script.execution.model.ScriptTaskSnapshot;

/**
 * Application boundary for starting and observing script tasks.
 */
public interface ScriptRunnerService {

    /**
     * Starts one background script task.
     *
     * @param request task request
     * @return generated task id
     */
    ScriptTaskId start(ScriptStartRequest request);

    /**
     * Returns the live task snapshot when known.
     *
     * @param taskId task id
     * @return current snapshot
     */
    Optional<ScriptTaskSnapshot> getTask(ScriptTaskId taskId);

    /**
     * Returns the terminal result from memory or durable storage.
     *
     * @param taskId task id
     * @return terminal result
     */
    Optional<ScriptTaskResult> getResult(ScriptTaskId taskId);

    /** Lists active and historical tasks using the supplied creation-time page. */
    ScriptTaskPage listTasks(ScriptTaskQuery query);

    /**
     * Requests cancellation of a running task.
     *
     * @param taskId task id
     * @return whether cancellation was accepted
     */
    boolean cancel(ScriptTaskId taskId);

    /** Supplies one response to the active operator input request. */
    default boolean submitInput(ScriptTaskId taskId, String requestId, Double value) {
        return false;
    }
}
