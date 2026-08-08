package com.psuext.script.execution.result;

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
import java.util.Objects;

import com.psuext.script.execution.model.ScriptRecordEventData;
import com.psuext.script.execution.model.ScriptLiveEventType;
import com.psuext.script.execution.model.ScriptLiveLogData;
import com.psuext.script.execution.model.ScriptLiveRecordData;
import com.psuext.script.execution.model.ScriptResultEventLevel;
import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.storage.ScriptTaskLogWriter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Captures script host callbacks into task-log and time-series sinks.
 *
 * <p>This is a prototype-scoped component because the result sink and task-log
 * writer belong to one running task. Runtime task creation should request a new
 * instance with those task-local collaborators.</p>
 */
public final class ScriptResultEventCaptureService {

    private static final Logger LOGGER = LoggerFactory.getLogger(ScriptResultEventCaptureService.class);
    private final ScriptResultEventSink sink;
    private final ScriptTaskLogWriter logWriter;
    private final ScriptTaskId taskId;
    private final ScriptLiveEventPublisher liveEventPublisher;
    private final ScriptSeriesRecordExtractor seriesRecordExtractor;

    /**
     * Creates an event capture service.
     *
     * @param sink result event sink for one task
     * @param logWriter task-log writer for one task
     * @param taskId task identifier for live events
     * @param liveEventPublisher live event publisher
     * @param seriesRecordExtractor record-to-series extractor
     */
    public ScriptResultEventCaptureService(
            ScriptResultEventSink sink,
            ScriptTaskLogWriter logWriter,
            ScriptTaskId taskId,
            ScriptLiveEventPublisher liveEventPublisher,
            ScriptSeriesRecordExtractor seriesRecordExtractor
    ) {
        this.sink = Objects.requireNonNull(sink, "sink must not be null");
        this.logWriter = Objects.requireNonNull(logWriter, "logWriter must not be null");
        this.taskId = Objects.requireNonNull(taskId, "taskId must not be null");
        this.liveEventPublisher = Objects.requireNonNull(
                liveEventPublisher,
                "liveEventPublisher must not be null");
        this.seriesRecordExtractor = Objects.requireNonNull(
                seriesRecordExtractor,
                "seriesRecordExtractor must not be null");
    }

    /**
     * Captures a script {@code log(level, message)} callback after binding-level
     * argument validation.
     *
     * @param timestamp event timestamp
     * @param level log level
     * @param message log message
     */
    public void captureLog(Instant timestamp, ScriptResultEventLevel level, String message) {
        Objects.requireNonNull(timestamp, "timestamp must not be null");
        Objects.requireNonNull(level, "level must not be null");
        Objects.requireNonNull(message, "message must not be null");
        appendTaskLog(timestamp, level, message);
        liveEventPublisher.publish(
                taskId,
                timestamp,
                ScriptLiveEventType.LOG,
                new ScriptLiveLogData(level, message));
    }

    /**
     * Captures an already validated record payload.
     *
     * @param timestamp event timestamp
     * @param data validated record data
     */
    public void captureRecord(Instant timestamp, ScriptRecordEventData data) {
        Objects.requireNonNull(timestamp, "timestamp must not be null");
        Objects.requireNonNull(data, "data must not be null");
        try {
            seriesRecordExtractor.extract(data)
                    .ifPresentOrElse(point -> {
                        sink.appendSeriesPoint(
                                point.seriesName(),
                                point.unit(),
                                point.timestamp(),
                                point.value());
                        liveEventPublisher.publish(
                                taskId,
                                timestamp,
                                ScriptLiveEventType.RECORD,
                                new ScriptLiveRecordData(
                                        point.timestamp(),
                                        point.seriesName(),
                                        point.unit(),
                                        point.value()));
                    }, () -> LOGGER.debug("Script record ignored: taskId={}", taskId));
        } catch (RuntimeException exception) {
            LOGGER.warn("Script record capture failed: taskId={} error={}",
                    taskId, exception.getClass().getSimpleName());
            throw exception;
        }
    }

    private void appendTaskLog(Instant timestamp, ScriptResultEventLevel level, String message) {
        logWriter.append(timestamp, level, message);
    }
}
