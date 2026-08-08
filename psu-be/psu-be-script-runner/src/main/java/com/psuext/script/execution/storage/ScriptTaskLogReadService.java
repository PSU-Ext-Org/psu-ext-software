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

import java.util.Objects;
import java.util.Optional;

import com.psuext.script.execution.model.ScriptTaskId;

/**
 * Opens bounded, streaming reads for durable task logs.
 */
public final class ScriptTaskLogReadService {

    private final ScriptTaskLogStore logStore;

    /**
     * Creates a task-log read service backed by one log store.
     *
     * @param logStore durable task-log storage
     */
    public ScriptTaskLogReadService(ScriptTaskLogStore logStore) {
        this.logStore = Objects.requireNonNull(logStore, "logStore must not be null");
    }

    /**
     * Opens a bounded read when the requested task log exists.
     *
     * @param taskId task identifier
     * @param range requested character range
     * @return open streaming read, if the task log exists
     */
    public Optional<ScriptTaskLogRead> open(ScriptTaskId taskId, ScriptTaskLogRange range) {
        Objects.requireNonNull(taskId, "taskId must not be null");
        Objects.requireNonNull(range, "range must not be null");
        return logStore.openReader(taskId).map(reader -> new ScriptTaskLogRead(reader, range));
    }
}
