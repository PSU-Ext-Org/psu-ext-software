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

import java.io.Reader;
import java.util.Optional;

import com.psuext.script.execution.model.ScriptTaskId;

/**
 * Storage boundary for per-task operational logs.
 */
public interface ScriptTaskLogStore {

    /**
     * Opens a writer for one task log.
     *
     * @param taskId task id
     * @param taskName human-readable task name
     * @return task log writer
     */
    ScriptTaskLogWriter open(ScriptTaskId taskId, String taskName);

    /**
     * Opens a reader for an existing task log.
     *
     * @param taskId task id
     * @return reader, if the log exists
     */
    Optional<Reader> openReader(ScriptTaskId taskId);
}
