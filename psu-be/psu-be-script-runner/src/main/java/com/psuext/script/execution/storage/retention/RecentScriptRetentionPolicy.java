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
import java.util.Objects;

import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.model.ScriptTaskResultSummary;

/**
 * Default bounded policy that retains the 50 most recent stored results.
 */
public final class RecentScriptRetentionPolicy implements ScriptRetentionPolicy {

    /** Maximum number of terminal results retained by the default policy. */
    public static final int MAX_RESULTS = 50;

    @Override
    public List<ScriptTaskId> taskIdsToDelete(List<ScriptTaskResultSummary> summaries, Instant now) {
        Objects.requireNonNull(summaries, "summaries must not be null");
        Objects.requireNonNull(now, "now must not be null");
        return summaries.stream()
                .sorted((left, right) -> right.endedAt().compareTo(left.endedAt()))
                .skip(MAX_RESULTS)
                .map(ScriptTaskResultSummary::taskId)
                .toList();
    }
}
