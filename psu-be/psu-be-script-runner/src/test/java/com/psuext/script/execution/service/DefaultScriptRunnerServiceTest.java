package com.psuext.script.execution.service;

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
import static org.awaitility.Awaitility.await;

import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.locks.LockSupport;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.psuext.script.execution.model.*;
import com.psuext.script.execution.config.ScriptResultCaptureConfiguration;
import com.psuext.script.execution.config.ScriptRuntimeProperties;
import com.psuext.script.execution.runtime.ScriptExecutionResult;
import com.psuext.script.execution.runtime.ScriptTaskExecutor;
import com.psuext.script.execution.result.InMemoryScriptLiveEventPublisher;
import com.psuext.script.execution.result.ScriptLiveEventSubscription;
import com.psuext.script.execution.result.ScriptResultEventCaptureService;
import com.psuext.script.execution.result.ScriptLiveEventPublisher;
import com.psuext.script.execution.storage.ScriptResultStore;
import com.psuext.script.execution.storage.ScriptTaskLogStore;
import com.psuext.script.execution.storage.ScriptTaskStore;
import com.psuext.script.execution.storage.file.FileScriptResultStore;
import com.psuext.script.execution.storage.file.FileScriptTaskLogStore;
import com.psuext.script.execution.storage.file.FileScriptTaskStore;
import com.psuext.script.execution.storage.retention.RecentScriptRetentionPolicy;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

class DefaultScriptRunnerServiceTest {

    @TempDir
    private Path temporaryDirectory;

    @Test
    void successfulTaskStoresResultAndLog() {
        runWithRunner(context -> {
            ScriptRunnerService runner = context.getBean(ScriptRunnerService.class);

            ScriptTaskId taskId = runner.start(new ScriptStartRequest(
                    "success", "log('INFO', 'started'); return {answer: 42};", Duration.ofSeconds(2)));
            ScriptTaskResult result = awaitResult(runner, taskId);

            assertThat(result.finalStatus()).isEqualTo(ScriptTaskState.COMPLETED);
            assertThat(result.returnValue()).isEqualTo(Map.of("answer", 42));
            assertThat(runner.getTask(taskId)).map(ScriptTaskSnapshot::state)
                    .contains(ScriptTaskState.COMPLETED);
            assertThat(context.getBean(ScriptTaskLogStore.class).openReader(taskId)).isPresent();
        });
    }

    @Test
    void listsAllTaskRecordsThroughRunnerBoundary() {
        runWithRunner(context -> {
            ScriptRunnerService runner = context.getBean(ScriptRunnerService.class);
            ScriptTaskId taskId = runner.start(new ScriptStartRequest(
                    "listed", "return 42;", Duration.ofSeconds(2)));

            awaitResult(runner, taskId);

            assertThat(runner.listTasks(new ScriptTaskQuery(10, 0)).items())
                    .extracting(ScriptTaskRecord::taskId)
                    .contains(taskId);
        });
    }

    @Test
    void publishesOrderedLifecycleAndLogEvents() {
        runWithRunner(context -> {
            ScriptRunnerService runner = context.getBean(ScriptRunnerService.class);
            ScriptLiveEventPublisher publisher = context.getBean(ScriptLiveEventPublisher.class);
            List<ScriptLiveEvent> events = new ArrayList<>();

            ScriptTaskId taskId = runner.start(new ScriptStartRequest(
                    "events", "log('INFO', 'started'); return 42;", Duration.ofSeconds(2)));
            awaitResult(runner, taskId);
            try (ScriptLiveEventSubscription ignored = publisher.subscribe(taskId, 0, events::add)) {
                awaitEvents(events);

                assertThat(events).extracting(ScriptLiveEvent::type)
                        .containsExactly(
                                com.psuext.script.execution.model.ScriptLiveEventType.STARTED,
                                com.psuext.script.execution.model.ScriptLiveEventType.LOG,
                                com.psuext.script.execution.model.ScriptLiveEventType.COMPLETED);
                assertThat(events).extracting(ScriptLiveEvent::sequence).containsExactly(1L, 2L, 3L);
            }
        });
    }

    @Test
    void publishesProgressAndUpdatesSnapshot() {
        runWithRunner(context -> {
            ScriptRunnerService runner = context.getBean(ScriptRunnerService.class);
            ScriptLiveEventPublisher publisher = context.getBean(ScriptLiveEventPublisher.class);
            List<ScriptLiveEvent> events = new ArrayList<>();

            ScriptTaskId taskId = runner.start(new ScriptStartRequest(
                    "progress", "progress(0.5); return 42;", Duration.ofSeconds(2)));
            awaitResult(runner, taskId);
            try (ScriptLiveEventSubscription ignored = publisher.subscribe(taskId, 0, events::add)) {
                await().atMost(Duration.ofSeconds(3)).untilAsserted(() -> assertThat(events).hasSize(3));

                assertThat(runner.getTask(taskId)).map(ScriptTaskSnapshot::progress).contains(0.5d);
                assertThat(events).extracting(ScriptLiveEvent::type).containsExactly(
                        ScriptLiveEventType.STARTED,
                        ScriptLiveEventType.PROGRESS,
                        ScriptLiveEventType.COMPLETED);
            }
        });
    }

    @Test
    void failedTaskStoresScriptError() {
        runWithRunner(context -> {
            ScriptRunnerService runner = context.getBean(ScriptRunnerService.class);

            ScriptTaskId taskId = runner.start(new ScriptStartRequest(
                    "failure", "throw new Error('broken');", Duration.ofSeconds(2)));
            ScriptTaskResult result = awaitResult(runner, taskId);

            assertThat(result.finalStatus()).isEqualTo(ScriptTaskState.FAILED);
            assertThat(result.error().source()).isEqualTo("SCRIPT");
        });
    }

    @Test
    void cancellationStoresCancelledResult() {
        runWithRunner(context -> {
            ScriptRunnerService runner = context.getBean(ScriptRunnerService.class);
            ScriptLiveEventPublisher publisher = context.getBean(ScriptLiveEventPublisher.class);
            List<ScriptLiveEvent> events = new ArrayList<>();
            ScriptTaskId taskId = runner.start(slowRequest(Duration.ofSeconds(5)));
            await().atMost(Duration.ofSeconds(1)).untilAsserted(() ->
                    assertThat(runner.getTask(taskId)).map(ScriptTaskSnapshot::state)
                            .contains(ScriptTaskState.RUNNING));

            assertThat(runner.cancel(taskId)).isTrue();
            assertThat(runner.getTask(taskId)).map(ScriptTaskSnapshot::state)
                    .contains(ScriptTaskState.CANCELLING);
            assertThat(awaitResult(runner, taskId).finalStatus()).isEqualTo(ScriptTaskState.CANCELLED);
            try (ScriptLiveEventSubscription ignored = publisher.subscribe(taskId, 0, events::add)) {
                awaitEvents(events);
                assertThat(events).extracting(ScriptLiveEvent::type).containsExactly(
                        ScriptLiveEventType.STARTED,
                        ScriptLiveEventType.CANCELLING,
                        ScriptLiveEventType.CANCELLED);
            }
        });
    }

    @Test
    void evictsCompletedSnapshotsAboveConfiguredCapacityButKeepsDurableTaskData() {
        ScriptRuntimeProperties properties = new ScriptRuntimeProperties();
        properties.setMaximumCompletedTasks(1);
        runWithRunner(properties, context -> {
            ScriptRunnerService runner = context.getBean(ScriptRunnerService.class);
            ScriptTaskId first = runner.start(new ScriptStartRequest("first", "return 1;", Duration.ofSeconds(2)));
            awaitResult(runner, first);
            ScriptTaskId second = runner.start(new ScriptStartRequest("second", "return 2;", Duration.ofSeconds(2)));
            awaitResult(runner, second);

            assertThat(runner.getTask(first)).isPresent();
            assertThat(runner.getResult(first)).isPresent();
            assertThat(runner.getTask(second)).isPresent();
        });
    }

    @Test
    void timeoutStoresTimedOutResult() {
        runWithRunner(context -> {
            ScriptRunnerService runner = context.getBean(ScriptRunnerService.class);
            ScriptTaskId taskId = runner.start(slowRequest(Duration.ofMillis(50)));

            assertThat(awaitResult(runner, taskId).finalStatus()).isEqualTo(ScriptTaskState.TIMED_OUT);
        });
    }

    @Test
    void pendingInputPublishesPromptAndResumesOnlyForMatchingRequest() {
        runWithRunner(context -> {
            ScriptRunnerService runner = context.getBean(ScriptRunnerService.class);
            ScriptLiveEventPublisher publisher = context.getBean(ScriptLiveEventPublisher.class);
            List<ScriptLiveEvent> events = new ArrayList<>();
            ScriptTaskId taskId = runner.start(new ScriptStartRequest("input", "INPUT?", Duration.ofSeconds(2)));

            await().atMost(Duration.ofSeconds(1)).untilAsserted(() -> assertThat(runner.getTask(taskId))
                    .hasValueSatisfying(snapshot -> {
                        assertThat(snapshot.state()).isEqualTo(ScriptTaskState.PENDING_INPUT);
                        assertThat(snapshot.pendingInput()).isNotNull();
                    }));
            ScriptPendingInput input = runner.getTask(taskId).orElseThrow().pendingInput();
            assertThat(runner.submitInput(taskId, "stale-request", 12.3d)).isFalse();
            assertThat(runner.submitInput(taskId, input.requestId(), 12.3d)).isTrue();

            assertThat(awaitResult(runner, taskId).returnValue()).isEqualTo(12.3d);
            try (ScriptLiveEventSubscription ignored = publisher.subscribe(taskId, 0, events::add)) {
                await().atMost(Duration.ofSeconds(1)).untilAsserted(() -> assertThat(events)
                        .extracting(ScriptLiveEvent::type)
                        .containsExactly(ScriptLiveEventType.STARTED, ScriptLiveEventType.INPUT_REQUESTED,
                                ScriptLiveEventType.INPUT_RESOLVED, ScriptLiveEventType.COMPLETED));
            }
        });
    }

    @Test
    void persistsSimultaneousCompletionCancellationAndTimeoutIndependently() {
        runWithRunner(context -> {
            ScriptRunnerService runner = context.getBean(ScriptRunnerService.class);
            ScriptTaskId completed = runner.start(new ScriptStartRequest("completed", "return 42;", Duration.ofSeconds(2)));
            ScriptTaskId cancelled = runner.start(slowRequest(Duration.ofSeconds(2)));
            ScriptTaskId timedOut = runner.start(slowRequest(Duration.ofMillis(50)));

            await().atMost(Duration.ofSeconds(1)).untilAsserted(() ->
                    assertThat(runner.getTask(cancelled)).map(ScriptTaskSnapshot::state)
                            .contains(ScriptTaskState.RUNNING));
            assertThat(runner.cancel(cancelled)).isTrue();

            assertThat(awaitResult(runner, completed).finalStatus()).isEqualTo(ScriptTaskState.COMPLETED);
            assertThat(awaitResult(runner, cancelled).finalStatus()).isEqualTo(ScriptTaskState.CANCELLED);
            assertThat(awaitResult(runner, timedOut).finalStatus()).isEqualTo(ScriptTaskState.TIMED_OUT);
            assertThat(runner.listTasks(new ScriptTaskQuery(10, 0)).items())
                    .extracting(ScriptTaskRecord::taskId)
                    .contains(completed, cancelled, timedOut);
        });
    }

    private void runWithRunner(Consumer<org.springframework.context.ConfigurableApplicationContext> scenario) {
        runWithRunner(new ScriptRuntimeProperties(), scenario);
    }

    private void runWithRunner(
            ScriptRuntimeProperties runtimeProperties,
            Consumer<org.springframework.context.ConfigurableApplicationContext> scenario) {
        new ApplicationContextRunner()
                .withUserConfiguration(
                TestConfiguration.class,
                        ScriptResultCaptureConfiguration.class)
                .withBean(Path.class, () -> temporaryDirectory)
                .withBean(ScriptRuntimeProperties.class, () -> runtimeProperties)
                .run(scenario::accept);
    }

    private static ScriptStartRequest slowRequest(Duration timeout) {
        return new ScriptStartRequest("slow", "query('PSU1', 'SLOW?');", timeout);
    }

    private static ScriptTaskResult awaitResult(ScriptRunnerService runner, ScriptTaskId taskId) {
        await().atMost(Duration.ofSeconds(3))
                .untilAsserted(() -> assertThat(runner.getResult(taskId)).isPresent());
        return runner.getResult(taskId).orElseThrow();
    }

    private static void awaitEvents(List<ScriptLiveEvent> events) {
        await().atMost(Duration.ofSeconds(3))
                .untilAsserted(() -> assertThat(events).hasSize(3));
    }

    @Configuration(proxyBeanMethods = false)
    static class TestConfiguration {

        @Bean
        ObjectMapper objectMapper() {
            return new ObjectMapper();
        }

        @Bean
        ScriptResultStore scriptResultStore(Path temporaryDirectory, ObjectMapper objectMapper) {
            return new FileScriptResultStore(temporaryDirectory.resolve("results"), objectMapper);
        }

        @Bean
        ScriptTaskLogStore scriptTaskLogStore(Path temporaryDirectory) {
            return new FileScriptTaskLogStore(temporaryDirectory.resolve("logs"));
        }

        @Bean
        ScriptTaskStore scriptTaskStore(Path temporaryDirectory, ObjectMapper objectMapper) {
            return new FileScriptTaskStore(temporaryDirectory.resolve("results"), objectMapper);
        }

        @Bean(destroyMethod = "shutdown")
        ExecutorService scriptTaskExecutor() {
            return Executors.newCachedThreadPool();
        }

        @Bean(destroyMethod = "shutdown")
        ScheduledExecutorService scriptTaskScheduler() {
            return Executors.newScheduledThreadPool(1);
        }

        @Bean
        ScriptRunnerService scriptRunnerService(
                ScriptResultStore resultStore,
                ScriptTaskLogStore logStore,
                ScriptTaskStore taskStore,
                org.springframework.beans.factory.ObjectProvider<ScriptResultEventCaptureService> captureProvider,
                ScriptLiveEventPublisher liveEventPublisher,
                @Qualifier("scriptTaskExecutor")
                ExecutorService executor,
                @Qualifier("scriptTaskScheduler")
                ScheduledExecutorService scheduler,
                ScriptTaskExecutor taskExecutor,
                ScriptTaskLifecycleEffects lifecycleEffects,
                ScriptRuntimeProperties runtimeProperties
        ) {
            return new DefaultScriptRunnerService(
                    resultStore,
                    logStore,
                    taskStore,
                    captureProvider,
                    liveEventPublisher,
                    executor,
                    scheduler,
                    new RecentScriptRetentionPolicy(),
                    taskExecutor,
                    lifecycleEffects,
                    runtimeProperties);
        }

        @Bean
        ScriptTaskExecutor scriptTaskExecutorEngine() {
            return request -> {
                if (request.source().contains("INPUT?")) {
                    return new ScriptExecutionResult(request.inputProvider().input("Enter DMM value", 1_000L), null);
                }
                if (request.source().contains("SLOW?")) {
                    while (!request.cancellationChecker().isCancelled()) {
                        Thread.onSpinWait();
                    }
                    long deadline = System.nanoTime() + Duration.ofMillis(100).toNanos();
                    while (System.nanoTime() < deadline) {
                        if (Thread.interrupted()) {
                            continue;
                        }
                        LockSupport.parkNanos(Duration.ofMillis(10).toNanos());
                    }
                }
                if (request.source().contains("throw new Error")) {
                    return new ScriptExecutionResult(null,
                            new ScriptTaskError("SCRIPT_ERROR", "broken", "SCRIPT", null));
                }
                if (request.source().contains("log(")) {
                    request.resultCapture().captureLog(java.time.Instant.now(), ScriptResultEventLevel.INFO, "started");
                }
                if (request.source().contains("progress(")) {
                    request.progressConsumer().accept(0.5d);
                }
                return new ScriptExecutionResult(request.source().contains("answer") ? Map.of("answer", 42) : 42, null);
            };
        }

        @Bean
        ScriptTaskLifecycleEffects scriptTaskLifecycleEffects(ScriptLiveEventPublisher publisher) {
            return new ScriptTaskLifecycleEffects(publisher);
        }

        @Bean
        ScriptLiveEventPublisher scriptLiveEventPublisher(
                @Qualifier("scriptTaskExecutor") ExecutorService executor) {
            return new InMemoryScriptLiveEventPublisher(executor);
        }
    }

}
