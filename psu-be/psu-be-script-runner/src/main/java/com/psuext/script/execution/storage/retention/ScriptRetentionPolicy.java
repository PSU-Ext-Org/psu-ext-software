package com.psuext.script.execution.storage.retention;

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

import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.model.ScriptTaskResultSummary;

/**
 * Policy boundary for deciding which stored script results should be evicted.
 * The policy does not perform deletion; the result lifecycle service combines
 * it with {@code ScriptResultStore.delete(...)}.
 */
public interface ScriptRetentionPolicy {

    /**
     * Selects stored results that no longer satisfy the retention policy.
     *
     * @param summaries stored result summaries
     * @param now current policy evaluation time
     * @return task IDs that may be deleted
     */
    List<ScriptTaskId> taskIdsToDelete(List<ScriptTaskResultSummary> summaries, Instant now);
}
