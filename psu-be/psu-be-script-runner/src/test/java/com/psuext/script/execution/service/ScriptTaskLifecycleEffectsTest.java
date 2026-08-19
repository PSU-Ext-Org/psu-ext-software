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

import java.time.Instant;
import java.util.function.Consumer;

import com.psuext.script.execution.model.ScriptLiveEvent;
import com.psuext.script.execution.model.ScriptLiveEventData;
import com.psuext.script.execution.model.ScriptLiveEventType;
import com.psuext.script.execution.model.ScriptLiveTaskStateData;
import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.model.ScriptTaskState;
import com.psuext.script.execution.result.ScriptLiveEventPublisher;
import com.psuext.script.execution.result.ScriptLiveEventSubscription;
import org.junit.jupiter.api.Test;

class ScriptTaskLifecycleEffectsTest {

    @Test
    void cancellationEventUsesTheCancellationTransitionState() {
        CapturingPublisher publisher = new CapturingPublisher();
        ScriptTaskLifecycleEffects effects = new ScriptTaskLifecycleEffects(publisher);
        ScriptTaskId taskId = ScriptTaskId.random();
        Instant timestamp = Instant.now();

        effects.cancelling(taskId, timestamp);

        assertThat(publisher.taskId).isEqualTo(taskId);
        assertThat(publisher.timestamp).isEqualTo(timestamp);
        assertThat(publisher.type).isEqualTo(ScriptLiveEventType.CANCELLING);
        assertThat(publisher.data).isEqualTo(new ScriptLiveTaskStateData(ScriptTaskState.CANCELLING, null));
    }

    private static final class CapturingPublisher implements ScriptLiveEventPublisher {

        private ScriptTaskId taskId;
        private Instant timestamp;
        private ScriptLiveEventType type;
        private ScriptLiveEventData data;

        @Override
        public ScriptLiveEventSubscription subscribe(
                ScriptTaskId requestedTaskId,
                long afterSequence,
                Consumer<ScriptLiveEvent> consumer
        ) {
            throw new UnsupportedOperationException("subscription is not used by this test");
        }

        @Override
        public void publish(
                ScriptTaskId publishedTaskId,
                Instant publishedTimestamp,
                ScriptLiveEventType publishedType,
                ScriptLiveEventData publishedData
        ) {
            taskId = publishedTaskId;
            timestamp = publishedTimestamp;
            type = publishedType;
            data = publishedData;
        }

        @Override
        public void removeTask(ScriptTaskId removedTaskId) {
            throw new UnsupportedOperationException("removal is not used by this test");
        }
    }
}
