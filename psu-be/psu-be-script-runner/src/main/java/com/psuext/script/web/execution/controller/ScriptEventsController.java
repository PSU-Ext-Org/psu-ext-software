package com.psuext.script.web.execution.controller;

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

import java.io.IOException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import com.psuext.script.execution.model.ScriptLiveEvent;
import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.result.ScriptLiveEventPublisher;
import com.psuext.script.execution.result.ScriptLiveEventSubscription;
import com.psuext.script.execution.service.ScriptRunnerService;
import com.psuext.script.web.execution.handler.ScriptResourceNotFoundException;
import com.psuext.script.web.execution.util.ScriptTaskIdResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * HTTP resource adapter for ordered script task Server-Sent Events.
 */
@RestController
@RequestMapping("/api/scripts")
@Tag(name = "Script events", description = "Script task Server-Sent Events")
public final class ScriptEventsController {

    private static final Logger LOGGER = LoggerFactory.getLogger(ScriptEventsController.class);
    private final ScriptRunnerService runner;
    private final ScriptLiveEventPublisher liveEventPublisher;
    private final ScriptTaskIdResolver taskIdResolver;

    /** Creates the script event resource adapter. */
    public ScriptEventsController(
            ScriptRunnerService runner,
            ScriptLiveEventPublisher liveEventPublisher,
            ScriptTaskIdResolver taskIdResolver) {
        this.runner = runner;
        this.liveEventPublisher = liveEventPublisher;
        this.taskIdResolver = taskIdResolver;
    }

    /** Streams ordered live events and completes after the terminal event. */
    @GetMapping(value = "/{taskId}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Stream script task events")
    public SseEmitter events(
            @PathVariable("taskId") String taskId,
            @RequestParam(value = "afterSequence", defaultValue = "0") long afterSequence) {
        LOGGER.info("Script task event stream requested: taskId={} afterSequence={}", taskId, afterSequence);

        ScriptTaskId id = taskIdResolver.resolve(taskId);
        if (runner.getTask(id).isEmpty()) {
            throw new ScriptResourceNotFoundException("TASK_NOT_FOUND", "Task not found: " + taskId);
        }
        if (afterSequence < 0) {
            throw new IllegalArgumentException("afterSequence must not be negative");
        }

        SseEmitter emitter = new SseEmitter(0L);
        AtomicReference<ScriptLiveEventSubscription> subscription = new AtomicReference<>();
        AtomicBoolean terminalSeen = new AtomicBoolean();
        emitter.onCompletion(() -> close(taskId, subscription));
        emitter.onTimeout(() -> close(taskId, subscription));
        emitter.onError(ignored -> close(taskId, subscription));

        ScriptLiveEventSubscription created = liveEventPublisher.subscribe(
                id, afterSequence, event -> send(taskId, emitter, subscription, terminalSeen, event));
        subscription.set(created);

        LOGGER.debug("Script task event stream subscribed: taskId={} afterSequence={}", taskId, afterSequence);
        if (terminalSeen.get()) {
            close(taskId, subscription);
        }
        return emitter;
    }

    private static void send(
            String taskId,
            SseEmitter emitter,
            AtomicReference<ScriptLiveEventSubscription> subscription,
            AtomicBoolean terminalSeen,
            ScriptLiveEvent event) {
        try {
            emitter.send(SseEmitter.event().id(Long.toString(event.sequence()))
                    .name(event.type().name()).data(event));
            if (event.type().isTerminal() && terminalSeen.compareAndSet(false, true)) {
                LOGGER.debug("Script task event stream terminal event: taskId={} sequence={} type={}",
                        taskId, event.sequence(), event.type());
                emitter.complete();
                close(taskId, subscription);
            }
        } catch (IOException | IllegalStateException exception) {
            LOGGER.warn("Script task event stream send failed: taskId={} error={}",
                    taskId, exception.getClass().getSimpleName());
            close(taskId, subscription);
            emitter.completeWithError(exception);
        }
    }

    private static void close(String taskId, AtomicReference<ScriptLiveEventSubscription> subscription) {
        ScriptLiveEventSubscription current = subscription.get();
        if (current != null) {
            current.close();
            LOGGER.debug("Script task event stream unsubscribed: taskId={}", taskId);
        }
    }
}
