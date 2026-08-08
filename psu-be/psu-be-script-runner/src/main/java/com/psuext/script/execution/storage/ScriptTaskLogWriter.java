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

import java.time.Instant;

import com.psuext.script.execution.model.ScriptResultEventLevel;

/**
 * Append-only writer for one script task log.
 */
public interface ScriptTaskLogWriter extends AutoCloseable {

    /**
     * Appends one timestamped log line.
     *
     * @param timestamp log timestamp
     * @param level log level
     * @param message readable log message
     */
    void append(Instant timestamp, ScriptResultEventLevel level, String message);

    @Override
    void close();
}
