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

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Comparator;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.RejectedExecutionException;

import com.psuext.script.execution.model.ScriptStartRequest;
import com.psuext.script.execution.model.ScriptResultQuery;
import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.model.ScriptTaskResult;
import com.psuext.script.execution.model.ScriptTaskSnapshot;
import com.psuext.script.execution.model.ScriptTaskPage;
import com.psuext.script.execution.model.ScriptTaskQuery;
import com.psuext.script.execution.model.ScriptTaskRecord;
import com.psuext.script.execution.model.ScriptTaskError;
import com.psuext.script.execution.model.ScriptPendingInput;
import com.psuext.script.execution.runtime.ScriptTaskExecutor;
import com.psuext.script.execution.runtime.ScriptTaskExecutionRequest;
import com.psuext.script.execution.config.ScriptRuntimeProperties;
import com.psuext.script.execution.config.ScriptStorageProperties;
import com.psuext.script.execution.result.ScriptResultEventCaptureService;
import com.psuext.script.execution.result.ScriptLiveEventPublisher;
import com.psuext.script.execution.result.ScriptTaskResultAssembler;
import com.psuext.script.execution.storage.ScriptResultStore;
import com.psuext.script.execution.storage.ScriptTaskLogStore;
import com.psuext.script.execution.storage.ScriptTaskLogWriter;
import com.psuext.script.execution.storage.ScriptTaskStore;
import com.psuext.script.execution.storage.retention.ScriptRetentionPolicy;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Default background task runner for the script runner application.
 */
@Service
public final class DefaultScriptRunnerService implements ScriptRunnerService {

    private static final Logger LOGGER = LoggerFactory.getLogger(DefaultScriptRunnerService.class);

    private final ScriptResultStore resultStore;
    private final ScriptTaskLogStore logStore;
    private final ScriptTaskStore taskStore;
    private final ObjectProvider<ScriptResultEventCaptureService> captureProvider;
    private final ScriptLiveEventPublisher liveEventPublisher;
    private final ExecutorService executor;
    private final ScheduledExecutorService scheduler;
    private final ScriptRetentionPolicy retentionPolicy;
    private final ScriptTaskExecutor taskExecutor;
    private final ScriptTaskLifecycleEffects lifecycleEffects;
    private final ScriptRuntimeProperties runtimeProperties;
    private final ScriptStorageProperties storageProperties;
    private final ConcurrentHashMap<ScriptTaskId, RunningScriptTask> tasks = new ConcurrentHashMap<>();

    /**
     * Creates the background runner.
     *
     * @param resultStore durable result store
     * @param logStore durable task log store
     * @param taskStore durable task catalogue
     * @param captureProvider prototype capture service provider
     * @param liveEventPublisher live event publisher
     * @param executor background execution pool
     * @param scheduler timeout scheduler
     * @param retentionPolicy policy for evicting old results
     * @param taskExecutor task-local script executor
     * @param lifecycleEffects task lifecycle side effects
     * @param runtimeProperties completed task retention limits
     */
    public DefaultScriptRunnerService(
            ScriptResultStore resultStore,
            ScriptTaskLogStore logStore,
            ScriptTaskStore taskStore,
            ObjectProvider<ScriptResultEventCaptureService> captureProvider,
            ScriptLiveEventPublisher liveEventPublisher,
            ExecutorService executor,
            ScheduledExecutorService scheduler,
            ScriptRetentionPolicy retentionPolicy,
            ScriptTaskExecutor taskExecutor,
            ScriptTaskLifecycleEffects lifecycleEffects,
            ScriptRuntimeProperties runtimeProperties
    ) {
        this(resultStore, logStore, taskStore, captureProvider, liveEventPublisher, executor, scheduler, retentionPolicy,
                taskExecutor, lifecycleEffects, runtimeProperties, new ScriptStorageProperties());
    }

    /**
     * Creates the background runner with explicit durable result storage settings.
     *
     * @param resultStore durable result store
     * @param logStore durable task log store
     * @param taskStore durable task catalogue
     * @param captureProvider prototype capture service provider
     * @param liveEventPublisher live event publisher
     * @param executor background execution pool
     * @param scheduler timeout scheduler
     * @param retentionPolicy policy for evicting old results
     * @param taskExecutor task-local script executor
     * @param lifecycleEffects task lifecycle side effects
     * @param runtimeProperties completed task retention limits
     * @param storageProperties durable script storage location
     */
    @Autowired
    public DefaultScriptRunnerService(
            ScriptResultStore resultStore,
            ScriptTaskLogStore logStore,
            ScriptTaskStore taskStore,
            ObjectProvider<ScriptResultEventCaptureService> captureProvider,
            ScriptLiveEventPublisher liveEventPublisher,
            @Qualifier("scriptTaskExecutor")
            ExecutorService executor,
            @Qualifier("scriptTaskScheduler")
            ScheduledExecutorService scheduler,
            ScriptRetentionPolicy retentionPolicy,
            ScriptTaskExecutor taskExecutor,
            ScriptTaskLifecycleEffects lifecycleEffects,
            ScriptRuntimeProperties runtimeProperties,
            ScriptStorageProperties storageProperties
    ) {
        this.resultStore = resultStore;
        this.logStore = logStore;
        this.taskStore = taskStore;
        this.captureProvider = captureProvider;
        this.liveEventPublisher = liveEventPublisher;
        this.executor = executor;
        this.scheduler = scheduler;
        this.retentionPolicy = retentionPolicy;
        this.taskExecutor = taskExecutor;
        this.lifecycleEffects = lifecycleEffects;
        this.runtimeProperties = runtimeProperties;
        this.storageProperties = storageProperties;
    }

    /** Converts work left active by a prior process into durable interrupted results. */
    @PostConstruct
    void recoverInterruptedTasks() {
        Instant recoveredAt = Instant.now();
        taskStore.findNonTerminal().forEach(record -> {
            ScriptTaskError error = new ScriptTaskError(
                    "RUNNER_RESTARTED", "Script Runner restarted before the task completed.", "RUNTIME", null);
            ScriptTaskResult result = new ScriptTaskResult(record.taskId(), record.name(), record.createdAt(),
                    record.startedAt(), recoveredAt, com.psuext.script.execution.model.ScriptTaskState.INTERRUPTED,
                    record.progress(), null, error, List.of(), java.util.Map.of("apiVersion", 1));
            resultStore.save(result);
            taskStore.save(ScriptTaskRecord.from(result));
        });
    }

    @Override
    public ScriptTaskId start(ScriptStartRequest request) {

        ScriptTaskId taskId = ScriptTaskId.random();
        Instant createdAt = Instant.now();
        ScriptTaskResultAssembler assembler = new ScriptTaskResultAssembler(
                taskId, request.name(), createdAt,
                storageProperties.getDirectory().resolve(taskId.toString()).resolve(".series"));

        ScriptTaskLogWriter logWriter = logStore.open(taskId, request.name());
        ScriptResultEventCaptureService capture = captureProvider.getObject(
                assembler,
                logWriter,
                taskId,
                liveEventPublisher);

        RunningScriptTask task = new RunningScriptTask(
                taskId,
                request.name(),
                request.source(),
                request.timeout(),
                createdAt);

        taskStore.save(ScriptTaskRecord.from(task.snapshot()));
        tasks.put(taskId, task);
        LOGGER.info("Script task queued: taskId={} name={} timeoutMs={} sourceLength={}",
                taskId, request.name(), request.timeout().toMillis(), request.source().length());

        try {
            task.setFuture(executor.submit(() -> execute(task, capture, assembler, logWriter)));
        } catch (RejectedExecutionException exception) {
            tasks.remove(taskId, task);
            logWriter.close();
            LOGGER.warn("Script task rejected: taskId={} name={}", taskId, request.name());
            throw new ScriptTaskRejectedException();
        }
        scheduler.schedule(() -> timeout(task, assembler, logWriter),
                request.timeout().toMillis(),
                TimeUnit.MILLISECONDS);

        return taskId;
    }

    @Override
    public Optional<ScriptTaskSnapshot> getTask(ScriptTaskId taskId) {
        evictCompletedTasks(Instant.now());
        RunningScriptTask task = tasks.get(taskId);
        if (task != null) {
            return Optional.of(task.snapshot());
        }
        return taskStore.findById(taskId).map(DefaultScriptRunnerService::toSnapshot);
    }

    @Override
    public Optional<ScriptTaskResult> getResult(ScriptTaskId taskId) {
        return resultStore.findById(taskId);
    }

    @Override
    public ScriptTaskPage listTasks(ScriptTaskQuery query) {
        ScriptTaskPage stored = taskStore.list(query);
        List<ScriptTaskRecord> items = stored.items().stream().map(record -> {
            RunningScriptTask task = tasks.get(record.taskId());
            return task == null ? record : ScriptTaskRecord.from(task.snapshot());
        }).toList();
        return new ScriptTaskPage(items, stored.limit(), stored.offset(), stored.total());
    }

    @Override
    public boolean cancel(ScriptTaskId taskId) {
        RunningScriptTask task = tasks.get(taskId);
        if (task == null) {
            LOGGER.debug("Script task cancellation ignored: taskId={} reason=not_found", taskId);
            return false;
        }

        // Keep transition effects ordered before the interrupted worker can publish its terminal state.
        synchronized (task) {
            boolean cancelled = task.cancel();
            if (cancelled) {
                taskStore.save(ScriptTaskRecord.from(task.snapshot()));
                LOGGER.info("Script task cancellation accepted: taskId={}", taskId);
                lifecycleEffects.cancelling(taskId, Instant.now());
            } else {
                LOGGER.debug("Script task cancellation ignored: taskId={} reason=terminal_or_cancelling", taskId);
            }
            return cancelled;
        }
    }

    @Override
    public boolean submitInput(ScriptTaskId taskId, String requestId, Double value) {
        RunningScriptTask task = tasks.get(taskId);
        if (task == null || !task.resolveInput(requestId, value)) {
            return false;
        }
        taskStore.save(ScriptTaskRecord.from(task.snapshot()));
        return true;
    }

    private void execute(
            RunningScriptTask task,
            ScriptResultEventCaptureService capture,
            ScriptTaskResultAssembler assembler,
            ScriptTaskLogWriter logWriter) {
        Instant startedAt = Instant.now();
        if (task.markRunning(startedAt)) {
            taskStore.save(ScriptTaskRecord.from(task.snapshot()));
            LOGGER.info("Script task started: taskId={} name={}", task.taskId(), task.snapshot().name());
            lifecycleEffects.started(task, assembler, startedAt);
        }
        task.finish(taskExecutor.execute(new ScriptTaskExecutionRequest(
                task.source(), capture, task::isCancellationRequested,
                progress -> updateProgress(task, progress),
                (message, timeoutMillis) -> awaitInput(task, message, timeoutMillis))), Instant.now())
                .ifPresent(outcome -> saveResult(lifecycleEffects.complete(
                        task, outcome, assembler, logWriter)));
    }

    private double awaitInput(RunningScriptTask task, String message, long timeoutMillis) {
        ScriptPendingInput input = task.requestInput(message, timeoutMillis, Instant.now());
        taskStore.save(ScriptTaskRecord.from(task.snapshot()));
        lifecycleEffects.inputRequested(task, input, Instant.now());
        double value = task.awaitInput(input);
        if (task.snapshot().state() == com.psuext.script.execution.model.ScriptTaskState.RUNNING) {
            taskStore.save(ScriptTaskRecord.from(task.snapshot()));
            lifecycleEffects.inputResolved(task, input, Instant.now());
        }
        return value;
    }

    private void updateProgress(RunningScriptTask task, double progress) {
        if (task.updateProgress(progress)) {
            lifecycleEffects.progress(task, progress, Instant.now());
        }
    }

    private void timeout(
            RunningScriptTask task,
            ScriptTaskResultAssembler assembler,
            ScriptTaskLogWriter logWriter) {
        task.timeout(Instant.now()).ifPresent(outcome -> {
            LOGGER.warn("Script task timed out: taskId={} timeoutMs={}", task.taskId(), task.timeout().toMillis());
            saveResult(lifecycleEffects.complete(task, outcome, assembler, logWriter));
        });
    }

    /**
     * Persists one terminal result and applies best-effort retention.
     *
     * <p>Result stores must make writes for distinct task ids independent. A
     * concurrent retention pass may observe a stale listing, but only deletes
     * ids selected by the retention policy; it cannot overwrite another task's
     * result or log.</p>
     */
    private void saveResult(ScriptTaskResult result) {
        if (result != null) {
            resultStore.save(result);
            taskStore.save(ScriptTaskRecord.from(result));
            LOGGER.info("Script task result persisted: taskId={} state={}",
                    result.taskId(), result.finalStatus());
            List<ScriptTaskId> retainedTaskIds = retentionPolicy.taskIdsToDelete(
                    resultStore.list(ScriptResultQuery.recent()), Instant.now());
            retainedTaskIds.forEach(resultStore::delete);
            if (!retainedTaskIds.isEmpty()) {
                LOGGER.info("Script task results removed by retention: count={}", retainedTaskIds.size());
            }
            evictCompletedTasks(Instant.now());
        }
    }

    private void evictCompletedTasks(Instant now) {
        Instant cutoff = now.minus(runtimeProperties.getCompletedTaskRetention());
        List<RunningScriptTask> completed = tasks.values().stream()
                .filter(RunningScriptTask::isTerminal)
                .sorted(Comparator.comparing(RunningScriptTask::endedAt).reversed())
                .toList();
        for (int index = 0; index < completed.size(); index++) {
            RunningScriptTask task = completed.get(index);
            boolean expired = task.isCompletedBefore(cutoff);
            boolean exceedsCapacity = index >= runtimeProperties.getMaximumCompletedTasks();
            if ((expired || exceedsCapacity) && tasks.remove(task.taskId(), task)) {
                liveEventPublisher.removeTask(task.taskId());
                LOGGER.info("Completed script task evicted: taskId={} reason={}", task.taskId(),
                        expired ? "retention" : "capacity");
            }
        }
    }

    private static ScriptTaskSnapshot toSnapshot(ScriptTaskRecord record) {
        return new ScriptTaskSnapshot(record.taskId(), record.name(), record.createdAt(), record.startedAt(),
                record.endedAt(), record.state(), record.progress(), record.error());
    }
}
