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

import com.psuext.script.execution.model.ScriptTaskPage;
import com.psuext.script.execution.model.ScriptTaskRecord;
import com.psuext.script.execution.model.ScriptTaskState;

/** Paginated all-status Script Runner task catalogue response. */
public record ScriptTaskPageResponse(List<Item> items, int limit, int offset, long total) {

    /** Maps one task page to the public HTTP representation. */
    public static ScriptTaskPageResponse from(ScriptTaskPage page) {
        return new ScriptTaskPageResponse(page.items().stream().map(Item::from).toList(), page.limit(),
                page.offset(), page.total());
    }

    /** Source-code-free task row for task-history tables. */
    public record Item(
            String taskId,
            String name,
            Instant createdAt,
            Instant startedAt,
            Instant endedAt,
            ScriptTaskState state,
            Double progress
    ) {
        static Item from(ScriptTaskRecord record) {
            return new Item(record.taskId().toString(), record.name(), record.createdAt(), record.startedAt(),
                    record.endedAt(), record.state(), record.progress());
        }
    }
}
