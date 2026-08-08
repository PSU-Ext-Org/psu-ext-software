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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import com.psuext.script.execution.model.*;
import com.psuext.script.execution.storage.ScriptTaskLogWriter;
import org.junit.jupiter.api.Test;

class ScriptResultEventCaptureServiceTest {

    private static final Instant CREATED_AT = Instant.parse("2026-07-19T12:00:00Z");
    private static final Instant EVENT_AT = Instant.parse("2026-07-19T12:00:01Z");
    private static final Instant ENDED_AT = Instant.parse("2026-07-19T12:00:02Z");

    @Test
    void capturesInfoLogInTaskLogOnly() {
        CapturingLogWriter logWriter = new CapturingLogWriter();
        ScriptTaskResultAssembler resultSink = resultSink();

        captureService(resultSink, logWriter).captureLog(EVENT_AT, ScriptResultEventLevel.INFO, "ready");
        ScriptTaskResult result = resultSink.complete(ScriptTaskState.COMPLETED,
                null, null, null, ENDED_AT);
        assertThat(result).isNotNull();

        assertReadableLineContains(logWriter, ScriptResultEventLevel.INFO, "ready");
    }

    @Test
    void capturesTypedLogInTaskLogOnly() {
        CapturingLogWriter logWriter = new CapturingLogWriter();
        ScriptTaskResultAssembler resultSink = resultSink();

        captureService(resultSink, logWriter)
                .captureLog(EVENT_AT, ScriptResultEventLevel.ERROR, "script failed");
        ScriptTaskResult result = resultSink.complete(ScriptTaskState.FAILED, null, null, null, ENDED_AT);

        assertThat(result).isNotNull();
        assertReadableLineContains(logWriter, ScriptResultEventLevel.ERROR, "script failed");
    }

    @Test
    void extractsRecordAsSeriesPointOnly() {
        CapturingLogWriter logWriter = new CapturingLogWriter();
        ScriptTaskResultAssembler resultSink = resultSink();
        ScriptRecordEventData data = new ScriptRecordEventData(EVENT_AT, "voltage", "V", 12.34);
        captureService(resultSink, logWriter).captureRecord(EVENT_AT, data);
        ScriptTaskResult result = resultSink.complete(ScriptTaskState.COMPLETED, null, null, null, ENDED_AT);

        assertThat(result.series()).singleElement().satisfies(series -> {
            assertThat(series.name()).isEqualTo("voltage");
            assertThat(series.unit()).isEqualTo("V");
            assertThat(series.points()).singleElement().satisfies(point -> {
                assertThat(point.timestamp()).isEqualTo(EVENT_AT);
                assertThat(point.value()).isEqualTo(12.34);
            });
        });
        assertThat(logWriter.lines).isEmpty();
    }

    @Test
    void rejectsNullTypedRecordPayload() {
        ScriptTaskResultAssembler resultSink = resultSink();

        assertThatNullPointerException()
                .isThrownBy(() -> captureService(resultSink, new CapturingLogWriter()).captureRecord(EVENT_AT, null));
    }

    private static ScriptResultEventCaptureService captureService(
            ScriptResultEventSink sink,
            ScriptTaskLogWriter logWriter) {
        return new ScriptResultEventCaptureService(
                sink,
                logWriter,
                ScriptTaskId.random(),
                new InMemoryScriptLiveEventPublisher(Runnable::run),
                new ScriptSeriesRecordExtractor());
    }

    private static ScriptTaskResultAssembler resultSink() {
        return new ScriptTaskResultAssembler(com.psuext.script.execution.model.ScriptTaskId.random(), "test", CREATED_AT);
    }

    private static void assertReadableLineContains(
            CapturingLogWriter logWriter,
            ScriptResultEventLevel level,
            String message) {
        assertThat(logWriter.lines).singleElement()
                .satisfies(line -> {
                    assertThat(line).startsWith(EVENT_AT + " " + level + " ");
                    assertThat(line).contains(message);
                });
    }

    private static final class CapturingLogWriter implements ScriptTaskLogWriter {

        private final List<String> lines = new ArrayList<>();

        @Override
        public void append(Instant timestamp, ScriptResultEventLevel level, String message) {
            lines.add(timestamp + " " + level + " " + message);
        }

        @Override
        public void close() {
        }
    }
}
