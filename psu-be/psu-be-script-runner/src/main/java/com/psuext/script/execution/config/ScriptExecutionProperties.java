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
 * Runtime limits applied to individual script host functions.
 */
@ConfigurationProperties("psu.scripts.execution")
public class ScriptExecutionProperties {

    private Duration maximumSleep = Duration.ofMinutes(5);

    /**
     * Returns the maximum duration accepted by {@code sleep(...)}.
     *
     * @return maximum sleep duration
     */
    public Duration getMaximumSleep() {
        return maximumSleep;
    }

    /**
     * Sets the maximum duration accepted by {@code sleep(...)}.
     *
     * @param maximumSleep maximum sleep duration
     */
    @SuppressWarnings("unused") // Invoked reflectively by Spring Boot configuration binding.
    public void setMaximumSleep(Duration maximumSleep) {
        if (maximumSleep == null || maximumSleep.isNegative() || maximumSleep.isZero()) {
            throw new IllegalArgumentException("maximum-sleep must be positive");
        }
        this.maximumSleep = maximumSleep;
    }
}
