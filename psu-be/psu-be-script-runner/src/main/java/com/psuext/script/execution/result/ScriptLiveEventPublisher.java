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
import java.util.function.Consumer;

import com.psuext.script.execution.model.ScriptLiveEvent;
import com.psuext.script.execution.model.ScriptLiveEventData;
import com.psuext.script.execution.model.ScriptLiveEventType;
import com.psuext.script.execution.model.ScriptTaskId;

/** Transport-neutral publisher for ordered live events belonging to tasks. */
public interface ScriptLiveEventPublisher {

    /**
     * Subscribes to a task and replays events after the supplied sequence.
     *
     * @param taskId task to observe
     * @param afterSequence last sequence already received, or zero
     * @param consumer event consumer
     * @return subscription handle
     */
    ScriptLiveEventSubscription subscribe(
            ScriptTaskId taskId,
            long afterSequence,
            Consumer<ScriptLiveEvent> consumer
    );

    /**
     * Publishes one event and assigns its task-local sequence number.
     *
     * @param taskId task to notify
     * @param timestamp event timestamp
     * @param type event type
     * @param data typed event payload
     */
    void publish(ScriptTaskId taskId, Instant timestamp, ScriptLiveEventType type, ScriptLiveEventData data);

    /**
     * Removes all retained live-event state for one completed task.
     *
     * @param taskId completed task identifier
     */
    void removeTask(ScriptTaskId taskId);
}
