package com.psuext.script.execution.config;

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

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * In-memory retention limits for completed script tasks and their live events.
 */
@ConfigurationProperties("psu.scripts.runtime")
public class ScriptRuntimeProperties {

    private int maximumCompletedTasks = 500;
    private Duration completedTaskRetention = Duration.ofHours(1);

    /** Returns the maximum number of completed task snapshots retained in memory. */
    public int getMaximumCompletedTasks() {
        return maximumCompletedTasks;
    }

    /** Sets the maximum number of completed task snapshots retained in memory. */
    public void setMaximumCompletedTasks(int maximumCompletedTasks) {
        if (maximumCompletedTasks < 1) {
            throw new IllegalArgumentException("maximum-completed-tasks must be positive");
        }
        this.maximumCompletedTasks = maximumCompletedTasks;
    }

    /** Returns how long completed task snapshots and event streams remain in memory. */
    public Duration getCompletedTaskRetention() {
        return completedTaskRetention;
    }

    /** Sets how long completed task snapshots and event streams remain in memory. */
    @SuppressWarnings("unused") // Invoked reflectively by Spring Boot configuration binding.
    public void setCompletedTaskRetention(Duration completedTaskRetention) {
        if (completedTaskRetention == null || completedTaskRetention.isNegative()
                || completedTaskRetention.isZero()) {
            throw new IllegalArgumentException("completed-task-retention must be positive");
        }
        this.completedTaskRetention = completedTaskRetention;
    }
}
