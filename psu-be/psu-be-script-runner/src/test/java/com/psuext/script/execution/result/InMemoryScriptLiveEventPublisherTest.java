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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import com.psuext.script.execution.model.ScriptLiveEvent;
import com.psuext.script.execution.model.ScriptLiveEventType;
import com.psuext.script.execution.model.ScriptLiveLogData;
import com.psuext.script.execution.model.ScriptResultEventLevel;
import com.psuext.script.execution.model.ScriptTaskId;
import org.junit.jupiter.api.Test;

class InMemoryScriptLiveEventPublisherTest {

    private static final Instant EVENT_AT = Instant.parse("2026-07-21T10:00:00Z");

    @Test
    void assignsSequencesAndReplaysEventsAfterRequestedSequence() {
        InMemoryScriptLiveEventPublisher publisher = new InMemoryScriptLiveEventPublisher(Runnable::run);
        ScriptTaskId taskId = ScriptTaskId.random();
        List<ScriptLiveEvent> initial = new ArrayList<>();

        publisher.publish(taskId, EVENT_AT, ScriptLiveEventType.STARTED,
                new com.psuext.script.execution.model.ScriptLiveTaskStateData(
                        com.psuext.script.execution.model.ScriptTaskState.RUNNING, null));
        publisher.publish(taskId, EVENT_AT, ScriptLiveEventType.LOG,
                new ScriptLiveLogData(ScriptResultEventLevel.INFO, "ready"));

        try (ScriptLiveEventSubscription ignored = publisher.subscribe(taskId, 1, initial::add)) {
            assertThat(initial).extracting(ScriptLiveEvent::sequence).containsExactly(2L);
        }
    }

    @Test
    void rejectsEventsAfterTerminalEvent() {
        InMemoryScriptLiveEventPublisher publisher = new InMemoryScriptLiveEventPublisher(Runnable::run);
        ScriptTaskId taskId = ScriptTaskId.random();
        com.psuext.script.execution.model.ScriptTaskError error = new com.psuext.script.execution.model.ScriptTaskError(
                "SCRIPT_FAILED", "failed", "SCRIPT", null);

        publisher.publish(taskId, EVENT_AT, ScriptLiveEventType.FAILED,
                new com.psuext.script.execution.model.ScriptLiveTerminalData(
                        com.psuext.script.execution.model.ScriptTaskState.FAILED,
                        new com.psuext.script.execution.model.ScriptTaskResultSummary(
                                taskId, "test", null, EVENT_AT,
                                com.psuext.script.execution.model.ScriptTaskState.FAILED),
                        error));

        assertThatThrownBy(() -> publisher.publish(
                taskId,
                EVENT_AT,
                ScriptLiveEventType.LOG,
                new ScriptLiveLogData(ScriptResultEventLevel.INFO, "late")))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void failingSubscriberDoesNotPreventOtherSubscriber() {
        InMemoryScriptLiveEventPublisher publisher = new InMemoryScriptLiveEventPublisher(Runnable::run);
        ScriptTaskId taskId = ScriptTaskId.random();
        List<ScriptLiveEvent> received = new ArrayList<>();

        try (ScriptLiveEventSubscription failed = publisher.subscribe(taskId, 0, ignored -> {
            throw new IllegalStateException("subscriber failed");
        });

            ScriptLiveEventSubscription healthy = publisher.subscribe(taskId, 0, received::add)) {
            assertThat(failed).isNotNull();
            assertThat(healthy).isNotNull();
            publisher.publish(taskId, EVENT_AT, ScriptLiveEventType.LOG,
                    new ScriptLiveLogData(ScriptResultEventLevel.INFO, "ready"));

            assertThat(received).hasSize(1);
        }
    }

    @Test
    void evictsOldestCompletedStreamAboveConfiguredCapacity() {
        InMemoryScriptLiveEventPublisher publisher = new InMemoryScriptLiveEventPublisher(
                Runnable::run, 1, Duration.ofHours(1));
        ScriptTaskId first = ScriptTaskId.random();
        ScriptTaskId second = ScriptTaskId.random();
        Instant now = Instant.now();

        publishCompleted(publisher, first, now);
        publishCompleted(publisher, second, now.plusSeconds(1));

        List<ScriptLiveEvent> firstEvents = new ArrayList<>();
        List<ScriptLiveEvent> secondEvents = new ArrayList<>();
        try (
                ScriptLiveEventSubscription ignoredFirst = publisher.subscribe(first, 0, firstEvents::add);
                ScriptLiveEventSubscription ignoredSecond
                        = publisher.subscribe(second, 0, secondEvents::add)
        ) {
            assertThat(firstEvents).isEmpty();
            assertThat(secondEvents).singleElement().extracting(ScriptLiveEvent::type)
                    .isEqualTo(ScriptLiveEventType.COMPLETED);
        }
    }

    @Test
    void evictsCompletedStreamAfterConfiguredRetention() {
        InMemoryScriptLiveEventPublisher publisher = new InMemoryScriptLiveEventPublisher(
                Runnable::run, 10, Duration.ofMillis(1));
        ScriptTaskId expired = ScriptTaskId.random();
        Instant now = Instant.now();

        publishCompleted(publisher, expired, now.minusSeconds(1));
        publisher.publish(ScriptTaskId.random(), now, ScriptLiveEventType.STARTED,
                new com.psuext.script.execution.model.ScriptLiveTaskStateData(
                        com.psuext.script.execution.model.ScriptTaskState.RUNNING, null));

        List<ScriptLiveEvent> events = new ArrayList<>();
        try (ScriptLiveEventSubscription ignored = publisher.subscribe(expired, 0, events::add)) {
            assertThat(events).isEmpty();
        }
    }

    private static void publishCompleted(
            InMemoryScriptLiveEventPublisher publisher,
            ScriptTaskId taskId,
            Instant timestamp) {
        publisher.publish(taskId, timestamp, ScriptLiveEventType.COMPLETED,
                new com.psuext.script.execution.model.ScriptLiveTerminalData(
                        com.psuext.script.execution.model.ScriptTaskState.COMPLETED,
                        new com.psuext.script.execution.model.ScriptTaskResultSummary(
                                taskId, "completed", timestamp, timestamp,
                                com.psuext.script.execution.model.ScriptTaskState.COMPLETED),
                        null));
    }
}
