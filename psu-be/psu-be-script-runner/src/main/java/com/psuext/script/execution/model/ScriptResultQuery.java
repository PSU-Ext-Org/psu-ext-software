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

import java.time.Instant;

/**
 * Query parameters for listing stored script task results.
 *
 * @param limit maximum number of summaries to return
 * @param offset number of matching summaries to skip
 * @param finalStatus optional terminal state filter
 * @param startedAfter optional inclusive lower bound for task start time
 * @param startedBefore optional inclusive upper bound for task start time
 */
public record ScriptResultQuery(
        int limit,
        int offset,
        ScriptTaskState finalStatus,
        Instant startedAfter,
        Instant startedBefore
) {

    /**
     * Default page size used when a caller does not provide a positive limit.
     */
    public static final int DEFAULT_LIMIT = 100;

    public ScriptResultQuery {
        if (limit <= 0) {
            limit = DEFAULT_LIMIT;
        }
        if (offset < 0) {
            throw new IllegalArgumentException("offset must not be negative");
        }
        if (finalStatus != null && !finalStatus.isTerminal()) {
            throw new IllegalArgumentException("finalStatus must be terminal");
        }
    }

    /**
     * Returns the default query for recent task results.
     *
     * @return default result query
     */
    public static ScriptResultQuery recent() {
        return new ScriptResultQuery(DEFAULT_LIMIT, 0,
                null, null, null);
    }
}
