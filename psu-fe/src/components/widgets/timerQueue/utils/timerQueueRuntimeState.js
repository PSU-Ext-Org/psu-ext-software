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

/** Initial state before the timer queue has been synchronized with a device. */
export const INITIAL_TIMER_QUEUE_RUNTIME = Object.freeze({
  activeId: "NONE",
  desynced: false,
  error: "",
  loading: false,
  message: "Queue not loaded",
  queueLoaded: false,
  remainingMs: 0,
  state: "IDLE",
  syncedAtMs: 0,
});

/** Named runtime transitions used by the timer queue runtime hook. */
export const TIMER_QUEUE_RUNTIME_ACTION = Object.freeze({
  ACTION_COMPLETED: "actionCompleted",
  NON_RUNNABLE: "nonRunnable",
  REQUEST_FAILED: "requestFailed",
  REQUEST_STARTED: "requestStarted",
  RESET: "reset",
  STATUS_RECEIVED: "statusReceived",
  TIMER_COMPLETED: "timerCompleted",
});

/**
 * Applies a single, explicit timer runtime transition.
 *
 * @param {object} runtime - Current timer runtime state.
 * @param {{type: string, message?: string, error?: string, runtime?: object}} action - Transition payload.
 * @returns {object} Updated runtime state.
 */
export function timerQueueRuntimeReducer(runtime, action) {
  switch (action.type) {
    case TIMER_QUEUE_RUNTIME_ACTION.RESET:
      return INITIAL_TIMER_QUEUE_RUNTIME;
    case TIMER_QUEUE_RUNTIME_ACTION.REQUEST_STARTED:
      return {
        ...runtime,
        error: "",
        loading: true,
        message: action.message,
      };
    case TIMER_QUEUE_RUNTIME_ACTION.NON_RUNNABLE:
      return {
        ...runtime,
        loading: false,
        message: action.message,
      };
    case TIMER_QUEUE_RUNTIME_ACTION.STATUS_RECEIVED:
      return {
        ...action.runtime,
        error: "",
        loading: false,
      };
    case TIMER_QUEUE_RUNTIME_ACTION.REQUEST_FAILED:
      return {
        ...runtime,
        error: action.error,
        loading: false,
        message: action.error,
      };
    case TIMER_QUEUE_RUNTIME_ACTION.ACTION_COMPLETED:
    case TIMER_QUEUE_RUNTIME_ACTION.TIMER_COMPLETED:
      return action.runtime;
    default:
      return runtime;
  }
}
