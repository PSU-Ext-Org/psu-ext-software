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

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Bounded execution resources for script work and live-event delivery.
 */
@ConfigurationProperties("psu.scripts.executors")
public class ScriptExecutorProperties {

    private int executionPoolSize = 4;
    private int executionQueueCapacity = 100;
    private int eventDeliveryPoolSize = 2;
    private int eventDeliveryQueueCapacity = 100;

    /** Returns the number of concurrent script executions. */
    public int getExecutionPoolSize() {
        return executionPoolSize;
    }

    /** Sets the number of concurrent script executions. */
    @SuppressWarnings("unused") // Invoked reflectively by Spring Boot configuration binding.
    public void setExecutionPoolSize(int executionPoolSize) {
        this.executionPoolSize = positive(executionPoolSize, "execution-pool-size");
    }

    /** Returns the number of queued script executions. */
    public int getExecutionQueueCapacity() {
        return executionQueueCapacity;
    }

    /** Sets the number of queued script executions. */
    @SuppressWarnings("unused") // Invoked reflectively by Spring Boot configuration binding.
    public void setExecutionQueueCapacity(int executionQueueCapacity) {
        this.executionQueueCapacity = positive(executionQueueCapacity, "execution-queue-capacity");
    }

    /** Returns the number of concurrent live-event delivery workers. */
    public int getEventDeliveryPoolSize() {
        return eventDeliveryPoolSize;
    }

    /** Sets the number of concurrent live-event delivery workers. */
    @SuppressWarnings("unused") // Invoked reflectively by Spring Boot configuration binding.
    public void setEventDeliveryPoolSize(int eventDeliveryPoolSize) {
        this.eventDeliveryPoolSize = positive(eventDeliveryPoolSize, "event-delivery-pool-size");
    }

    /** Returns the number of queued live-event delivery callbacks. */
    public int getEventDeliveryQueueCapacity() {
        return eventDeliveryQueueCapacity;
    }

    /** Sets the number of queued live-event delivery callbacks. */
    @SuppressWarnings("unused") // Invoked reflectively by Spring Boot configuration binding.
    public void setEventDeliveryQueueCapacity(int eventDeliveryQueueCapacity) {
        this.eventDeliveryQueueCapacity = positive(
                eventDeliveryQueueCapacity,
                "event-delivery-queue-capacity");
    }

    private static int positive(int value, String propertyName) {
        if (value < 1) {
            throw new IllegalArgumentException(propertyName + " must be positive");
        }
        return value;
    }
}
