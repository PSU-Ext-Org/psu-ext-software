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

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import com.psuext.script.execution.result.InMemoryScriptLiveEventPublisher;
import com.psuext.script.execution.result.ScriptLiveEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Thread-pool configuration for script task execution and timeout handling.
 */
@Configuration
public class ScriptRunnerConfiguration {

    /**
     * Creates the background script execution pool.
     *
     * @return execution pool
     */
    @Bean(destroyMethod = "shutdown")
    ThreadPoolExecutor scriptTaskExecutor(ScriptExecutorProperties properties) {
        return boundedExecutor(properties.getExecutionPoolSize(), properties.getExecutionQueueCapacity());
    }

    /** Creates the isolated bounded executor used to deliver live events. */
    @Bean(destroyMethod = "shutdown")
    ThreadPoolExecutor scriptEventDeliveryExecutor(ScriptExecutorProperties properties) {
        return boundedExecutor(properties.getEventDeliveryPoolSize(), properties.getEventDeliveryQueueCapacity());
    }

    /**
     * Creates the task timeout scheduler.
     *
     * @return timeout scheduler
     */
    @Bean(destroyMethod = "shutdown")
    ScheduledExecutorService scriptTaskScheduler() {
        return Executors.newScheduledThreadPool(1);
    }

    /**
     * Creates the transport-neutral live event publisher.
     *
     * @param deliveryExecutor executor used to isolate subscriber callbacks
     * @return application-wide live event publisher
     */
    @Bean
    ScriptLiveEventPublisher scriptLiveEventPublisher(
            @org.springframework.beans.factory.annotation.Qualifier("scriptEventDeliveryExecutor")
            ThreadPoolExecutor deliveryExecutor,
            ScriptRuntimeProperties runtimeProperties) {
        return new InMemoryScriptLiveEventPublisher(
                deliveryExecutor,
                runtimeProperties.getMaximumCompletedTasks(),
                runtimeProperties.getCompletedTaskRetention());
    }

    private static ThreadPoolExecutor boundedExecutor(int poolSize, int queueCapacity) {
        return new ThreadPoolExecutor(
                poolSize,
                poolSize,
                0L,
                TimeUnit.MILLISECONDS,
                new ArrayBlockingQueue<>(queueCapacity),
                new ThreadPoolExecutor.AbortPolicy());
    }
}
