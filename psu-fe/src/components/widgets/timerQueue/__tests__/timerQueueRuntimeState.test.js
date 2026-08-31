/**
 * Copyright 2026 The PSU-EXT Authors
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { describe, expect, it } from "vitest";
import {
  INITIAL_TIMER_QUEUE_RUNTIME,
  TIMER_QUEUE_RUNTIME_ACTION,
  timerQueueRuntimeReducer,
} from "../utils/timerQueueRuntimeState.js";

describe("timerQueueRuntimeReducer", () => {
  it("applies named request and failure transitions", () => {
    const refreshing = timerQueueRuntimeReducer(INITIAL_TIMER_QUEUE_RUNTIME, {
      message: "Refreshing status",
      type: TIMER_QUEUE_RUNTIME_ACTION.REQUEST_STARTED,
    });
    const failed = timerQueueRuntimeReducer(refreshing, {
      error: "Connection lost",
      type: TIMER_QUEUE_RUNTIME_ACTION.REQUEST_FAILED,
    });

    expect(refreshing).toMatchObject({ error: "", loading: true, message: "Refreshing status" });
    expect(failed).toMatchObject({ error: "Connection lost", loading: false, message: "Connection lost" });
  });

  it("replaces runtime state for a received status and reset", () => {
    const received = timerQueueRuntimeReducer(INITIAL_TIMER_QUEUE_RUNTIME, {
      runtime: {
        activeId: "A01",
        desynced: false,
        message: "Running",
        queueLoaded: true,
        remainingMs: 5000,
        state: "RUNNING",
        syncedAtMs: 100,
      },
      type: TIMER_QUEUE_RUNTIME_ACTION.STATUS_RECEIVED,
    });

    expect(received).toMatchObject({ activeId: "A01", error: "", loading: false, state: "RUNNING" });
    expect(timerQueueRuntimeReducer(received, { type: TIMER_QUEUE_RUNTIME_ACTION.RESET }))
      .toBe(INITIAL_TIMER_QUEUE_RUNTIME);
  });
});
