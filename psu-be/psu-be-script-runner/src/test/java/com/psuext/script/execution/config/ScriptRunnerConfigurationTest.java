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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

class ScriptRunnerConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(ScriptRunnerConfiguration.class, TestPropertiesConfiguration.class)
            .withPropertyValues(
                    "psu.scripts.executors.execution-pool-size=1",
                    "psu.scripts.executors.execution-queue-capacity=1",
                    "psu.scripts.executors.event-delivery-pool-size=2",
                    "psu.scripts.executors.event-delivery-queue-capacity=3");

    @Test
    void createsIndependentBoundedExecutionAndDeliveryPools() {
        contextRunner.run(context -> {
            ThreadPoolExecutor execution = context.getBean("scriptTaskExecutor", ThreadPoolExecutor.class);
            ThreadPoolExecutor delivery = context.getBean("scriptEventDeliveryExecutor", ThreadPoolExecutor.class);

            assertThat(execution).isNotSameAs(delivery);
            assertThat(execution.getCorePoolSize()).isEqualTo(1);
            assertThat(execution.getQueue().remainingCapacity()).isEqualTo(1);
            assertThat(delivery.getCorePoolSize()).isEqualTo(2);
            assertThat(delivery.getQueue().remainingCapacity()).isEqualTo(3);
        });
    }

    @Test
    void rejectsExecutionAfterConfiguredPoolAndQueueAreFull() {
        contextRunner.run(context -> {
            ThreadPoolExecutor execution = context.getBean("scriptTaskExecutor", ThreadPoolExecutor.class);
            CountDownLatch started = new CountDownLatch(1);
            CountDownLatch release = new CountDownLatch(1);
            execution.execute(() -> await(started, release));
            assertThat(started.await(1, TimeUnit.SECONDS)).isTrue();
            execution.execute(() -> { });

            assertThatThrownBy(() -> execution.execute(() -> { }))
                    .isInstanceOf(java.util.concurrent.RejectedExecutionException.class);
            release.countDown();
        });
    }

    private static void await(CountDownLatch started, CountDownLatch release) {
        started.countDown();
        try {
            release.await();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }

    @Configuration
    @EnableConfigurationProperties({ScriptRuntimeProperties.class, ScriptExecutorProperties.class})
    static class TestPropertiesConfiguration {
    }
}
