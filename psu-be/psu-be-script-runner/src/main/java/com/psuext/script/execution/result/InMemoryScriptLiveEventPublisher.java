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
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import java.time.Duration;

import com.psuext.script.execution.model.ScriptLiveEvent;
import com.psuext.script.execution.model.ScriptLiveEventData;
import com.psuext.script.execution.model.ScriptLiveEventType;
import com.psuext.script.execution.model.ScriptTaskId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * In-memory live-event publisher with bounded replay and isolated subscribers.
 *
 * <p>Publication only enqueues work. Subscriber callbacks run on the supplied
 * executor, so a slow observer cannot block the task thread.</p>
 */
public final class InMemoryScriptLiveEventPublisher implements ScriptLiveEventPublisher {

    private static final int DEFAULT_REPLAY_CAPACITY = 256;
    private static final int DEFAULT_SUBSCRIBER_CAPACITY = 256;
    private static final Logger LOGGER = LoggerFactory.getLogger(InMemoryScriptLiveEventPublisher.class);

    private final Executor deliveryExecutor;
    private final int replayCapacity;
    private final int subscriberCapacity;
    private final int maximumCompletedStreams;
    private final Duration completedStreamRetention;
    private final Map<ScriptTaskId, TaskStream> streams = new LinkedHashMap<>();

    /**
     * Creates a publisher with bounded replay and subscriber queues.
     *
     * @param deliveryExecutor executor used for subscriber callbacks
     * @param replayCapacity number of events retained per task
     * @param subscriberCapacity number of queued events per subscriber
     */
    public InMemoryScriptLiveEventPublisher(
            Executor deliveryExecutor,
            int replayCapacity,
            int subscriberCapacity,
            int maximumCompletedStreams,
            Duration completedStreamRetention) {
        this.deliveryExecutor = Objects.requireNonNull(deliveryExecutor, "deliveryExecutor must not be null");
        if (replayCapacity < 1) {
            throw new IllegalArgumentException("replayCapacity must be positive");
        }
        if (subscriberCapacity < 1) {
            throw new IllegalArgumentException("subscriberCapacity must be positive");
        }
        if (maximumCompletedStreams < 1) {
            throw new IllegalArgumentException("maximumCompletedStreams must be positive");
        }
        this.completedStreamRetention = Objects.requireNonNull(
                completedStreamRetention,
                "completedStreamRetention must not be null");
        if (completedStreamRetention.isNegative() || completedStreamRetention.isZero()) {
            throw new IllegalArgumentException("completedStreamRetention must be positive");
        }
        this.replayCapacity = replayCapacity;
        this.subscriberCapacity = subscriberCapacity;
        this.maximumCompletedStreams = maximumCompletedStreams;
    }

    /**
     * Creates a publisher with default bounded capacities.
     *
     * @param deliveryExecutor executor used for subscriber callbacks
     */
    public InMemoryScriptLiveEventPublisher(Executor deliveryExecutor) {
        this(deliveryExecutor, DEFAULT_REPLAY_CAPACITY, DEFAULT_SUBSCRIBER_CAPACITY, 500, Duration.ofHours(1));
    }

    /**
     * Creates a publisher with default queues and configured completed-stream retention.
     *
     * @param deliveryExecutor executor used for subscriber callbacks
     * @param maximumCompletedStreams maximum terminal streams retained
     * @param completedStreamRetention terminal stream retention duration
     */
    public InMemoryScriptLiveEventPublisher(
            Executor deliveryExecutor,
            int maximumCompletedStreams,
            Duration completedStreamRetention) {
        this(deliveryExecutor, DEFAULT_REPLAY_CAPACITY, DEFAULT_SUBSCRIBER_CAPACITY,
                maximumCompletedStreams, completedStreamRetention);
    }

    @Override
    public ScriptLiveEventSubscription subscribe(
            ScriptTaskId taskId,
            long afterSequence,
            Consumer<ScriptLiveEvent> consumer) {
        Objects.requireNonNull(taskId, "taskId must not be null");
        if (afterSequence < 0) {
            throw new IllegalArgumentException("afterSequence must not be negative");
        }
        Objects.requireNonNull(consumer, "consumer must not be null");

        TaskStream stream = stream(taskId);
        Subscriber subscriber = new Subscriber(consumer);
        int replayedEvents;
        synchronized (stream) {
            subscriber.stream = stream;
            stream.subscribers.add(subscriber);
            List<ScriptLiveEvent> replay = stream.history.values().stream()
                    .filter(event -> event.sequence() > afterSequence)
                    .toList();
            replay.forEach(subscriber::offerLocked);
            replayedEvents = replay.size();
        }
        LOGGER.debug("Script live-event subscriber added: taskId={} afterSequence={} replayedEvents={}",
                taskId, afterSequence, replayedEvents);
        subscriber.scheduleDrain();
        return subscriber;
    }

    @Override
    public void publish(
            ScriptTaskId taskId,
            Instant timestamp,
            ScriptLiveEventType type,
            ScriptLiveEventData data
    ) {
        Objects.requireNonNull(taskId, "taskId must not be null");
        Objects.requireNonNull(timestamp, "timestamp must not be null");
        Objects.requireNonNull(type, "type must not be null");
        Objects.requireNonNull(data, "data must not be null");

        pruneCompletedStreams(timestamp);
        TaskStream stream = stream(taskId);
        List<Subscriber> subscribers;
        ScriptLiveEvent event;

        synchronized (stream) {
            if (stream.terminal) {
                throw new IllegalStateException("task already has a terminal live event");
            }
            event = new ScriptLiveEvent(taskId, ++stream.sequence, timestamp, type, data);
            stream.history.put(event.sequence(), event);
            while (stream.history.size() > replayCapacity) {
                stream.history.remove(stream.history.keySet().iterator().next());
            }
            if (type.isTerminal()) {
                stream.terminal = true;
                stream.completedAt = timestamp;
            }
            subscribers = List.copyOf(stream.subscribers);
            subscribers.forEach(subscriber -> subscriber.offerLocked(event));
        }

        subscribers.forEach(Subscriber::scheduleDrain);
        if (type.isTerminal()) {
            pruneCompletedStreams(timestamp);
        }
    }

    @Override
    public void removeTask(ScriptTaskId taskId) {
        Objects.requireNonNull(taskId, "taskId must not be null");
        TaskStream removed;
        synchronized (streams) {
            removed = streams.remove(taskId);
        }
        if (removed != null) {
            int subscriberCount;
            synchronized (removed) {
                subscriberCount = removed.subscribers.size();
                List.copyOf(removed.subscribers).forEach(Subscriber::close);
            }
            LOGGER.debug("Script live-event stream removed: taskId={} subscriberCount={}",
                    taskId, subscriberCount);
        }
    }

    private void pruneCompletedStreams(Instant now) {
        List<ScriptTaskId> remove = new ArrayList<>();
        synchronized (streams) {
            streams.forEach((taskId, stream) -> {
                if (stream.completedAt != null
                        && !stream.completedAt.plus(completedStreamRetention).isAfter(now)) {
                    remove.add(taskId);
                }
            });
            streams.entrySet().stream()
                    .filter(entry -> entry.getValue().completedAt != null)
                    .sorted(Map.Entry.comparingByValue(
                            java.util.Comparator.comparing(stream -> stream.completedAt)))
                    .limit(Math.max(0, completedStreamCount() - maximumCompletedStreams))
                    .map(Map.Entry::getKey)
                    .forEach(remove::add);
        }
        remove.stream().distinct().forEach(this::removeTask);
    }

    private int completedStreamCount() {
        return (int) streams.values().stream().filter(stream -> stream.completedAt != null).count();
    }

    private TaskStream stream(ScriptTaskId taskId) {
        synchronized (streams) {
            return streams.computeIfAbsent(taskId, TaskStream::new);
        }
    }

    private final class Subscriber implements ScriptLiveEventSubscription {

        private final Consumer<ScriptLiveEvent> consumer;
        private final ArrayDeque<ScriptLiveEvent> queue = new ArrayDeque<>();
        private final AtomicBoolean draining = new AtomicBoolean();
        private boolean closed;
        private TaskStream stream;

        private Subscriber(Consumer<ScriptLiveEvent> consumer) {
            this.consumer = consumer;
        }

        private synchronized void offerLocked(ScriptLiveEvent event) {
            if (closed) {
                return;
            }
            if (queue.size() >= subscriberCapacity) {
                closed = true;
                LOGGER.warn("Script live-event subscriber queue overflow: taskId={}", stream.taskId);
                return;
            }
            queue.addLast(event);
        }

        private void scheduleDrain() {
            if (draining.compareAndSet(false, true)) {
                try {
                    deliveryExecutor.execute(this::drain);
                } catch (RuntimeException exception) {
                    LOGGER.warn("Script live-event delivery rejected: taskId={} error={}",
                            stream.taskId, exception.getClass().getSimpleName());
                    close();
                }
            }
        }

        private void drain() {
            try {
                while (true) {
                    ScriptLiveEvent event;
                    synchronized (this) {
                        event = queue.pollFirst();
                        if (event == null) {
                            draining.set(false);
                            if (!queue.isEmpty() && draining.compareAndSet(false, true)) {
                                continue;
                            }
                            return;
                        }
                    }
                    try {
                        consumer.accept(event);
                    } catch (RuntimeException exception) {
                        LOGGER.warn("Script live-event consumer failed: taskId={} error={}",
                                stream.taskId, exception.getClass().getSimpleName());
                        close();
                        return;
                    }
                }
            } finally {
                draining.set(false);
            }
        }

        @Override
        public void close() {
            synchronized (this) {
                if (closed) {
                    return;
                }
                closed = true;
                queue.clear();
            }
            TaskStream currentStream = stream;
            if (currentStream != null) {
                synchronized (currentStream) {
                    currentStream.subscribers.remove(this);
                }
                LOGGER.debug("Script live-event subscriber removed: taskId={}", currentStream.taskId);
            }
        }
    }

    private final class TaskStream {
        private final ScriptTaskId taskId;
        private final Map<Long, ScriptLiveEvent> history = new LinkedHashMap<>();
        private final List<Subscriber> subscribers = new ArrayList<>();
        private long sequence;
        private volatile boolean terminal;
        private volatile Instant completedAt;

        private TaskStream(ScriptTaskId taskId) {
            this.taskId = taskId;
        }
    }
}
