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
import { parseDurationSecondsToMs } from "../timerQueueConfig.js";

/** Timer state reported while the device is actively counting down. */
export const RUNNING_TIMER_STATE = "RUNNING";

/** Device states that can continue an already loaded queue. */
export const RESUMABLE_TIMER_STATES = new Set(["PAUSED", "OVP", "OCP", "OVR"]);

const EMPTY_STATUS_RESPONSE = "NONE,IDLE,0.000";

/**
 * Builds runtime state from a raw `TIM:STATUS?` response and the local preset.
 *
 * @param {string} response - Device status response.
 * @param {Array<{id: string, durationSeconds: string}>} configuredTimers - Local timer preset.
 * @returns {object} Runtime state suitable for display.
 */
export function createRuntimeFromStatusResponse(response, configuredTimers) {
  const parsed = parseTimerStatusResponse(response);
  const activeTimer = configuredTimers.find((timer) => timer.id === parsed.activeId) || null;
  const queueLoaded = parsed.activeId !== "NONE";
  const desynced = queueLoaded && !activeTimer;

  return {
    activeId: parsed.activeId,
    desynced,
    error: "",
    message: getRuntimeStatusMessage({ desynced, parsed, queueLoaded, timerCount: configuredTimers.length }),
    queueLoaded,
    remainingMs: parsed.remainingMs,
    state: parsed.state,
    syncedAtMs: parsed.state === RUNNING_TIMER_STATE ? Date.now() : 0,
  };
}

/**
 * Parses a timer status response, defaulting malformed empty values to idle.
 *
 * @param {unknown} response - Raw status response from the device.
 * @returns {{activeId: string, remainingMs: number, state: string}} Parsed status values.
 */
export function parseTimerStatusResponse(response) {
  const normalized = String(response || "").trim() || EMPTY_STATUS_RESPONSE;
  const [activeId = "NONE", state = "IDLE", remainingText = "0.000"] = normalized.split(",");

  return {
    activeId: String(activeId || "NONE").trim() || "NONE",
    remainingMs: parseTimerRemainingToMs(remainingText),
    state: String(state || "IDLE").trim() || "IDLE",
  };
}

/**
 * Converts the remaining-seconds field from a status response into milliseconds.
 *
 * @param {unknown} value - Device-reported seconds.
 * @returns {number} Non-negative milliseconds.
 */
export function parseTimerRemainingToMs(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return 0;
  }

  const seconds = Number.parseFloat(normalized);
  if (!Number.isFinite(seconds) || seconds < 0) {
    return 0;
  }

  return Math.round(seconds * 1000);
}

/**
 * Returns the primary runtime action label for the current device state.
 *
 * @param {{queueLoaded: boolean, state: string}} runtime - Current runtime state.
 * @returns {string} Action label.
 */
export function getTimerActionLabel(runtime) {
  if (runtime.state === RUNNING_TIMER_STATE) {
    return "Pause";
  }

  if (RESUMABLE_TIMER_STATES.has(runtime.state) && runtime.queueLoaded) {
    return "Resume";
  }

  return "Load and start";
}

/**
 * Returns the concise runtime message shown below the editor.
 *
 * @param {{config: object, device: object | undefined, deviceConnected: boolean, runtime: object, validationError: string, wsConnected: boolean}} context - Current widget and connection state.
 * @returns {string} User-facing helper text.
 */
export function getTimerQueueHelperText({ config, device, deviceConnected, runtime, validationError, wsConnected }) {
  if (!wsConnected) {
    return "WebSocket offline";
  }

  if (!device) {
    return validationError ? "Needs configuration" : "Device unavailable";
  }

  if (!deviceConnected) {
    return "Device disconnected";
  }

  if (runtime.error) {
    return runtime.error;
  }

  if (runtime.desynced) {
    return "Out of sync";
  }

  if (!runtime.queueLoaded && config.timers.length) {
    return "Preset not loaded";
  }

  return runtime.message;
}

/**
 * Formats milliseconds as a fixed minutes, seconds, and milliseconds display.
 *
 * @param {number} remainingMs - Remaining duration in milliseconds.
 * @returns {string} Formatted duration.
 */
export function formatRemaining(remainingMs) {
  const safeRemainingMs = Math.max(0, Number(remainingMs) || 0);
  const totalSeconds = Math.floor(safeRemainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = safeRemainingMs % 1000;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

/**
 * Returns an explanatory message when no device command can be sent.
 *
 * @param {{device: object | undefined, wsConnected: boolean}} context - Connection state.
 * @returns {string} Runtime message.
 */
export function buildNonRunnableRuntimeMessage({ wsConnected, device }) {
  if (!wsConnected) {
    return "WebSocket offline";
  }

  if (!device) {
    return "Device unavailable";
  }

  return "Device disconnected";
}

/**
 * Advances the local progress display after a running timer reaches zero.
 *
 * @param {{configTimers: Array<object>, runtime: object}} context - Preset and runtime state.
 * @returns {object | null} Next runtime state, or null when no local transition applies.
 */
export function updateRuntimeAfterCompletion({ configTimers, runtime }) {
  const activeIndex = configTimers.findIndex((timer) => timer.id === runtime.activeId);
  if (activeIndex < 0) {
    return null;
  }

  const nextTimer = configTimers[activeIndex + 1];
  if (nextTimer) {
    return {
      ...runtime,
      activeId: nextTimer.id,
      desynced: false,
      error: "",
      message: "Running",
      queueLoaded: true,
      remainingMs: parseDurationSecondsToMs(nextTimer.durationSeconds) || 0,
      state: RUNNING_TIMER_STATE,
      syncedAtMs: Date.now(),
    };
  }

  return {
    ...runtime,
    activeId: "NONE",
    desynced: false,
    error: "",
    message: "Queue complete",
    queueLoaded: false,
    remainingMs: 0,
    state: "IDLE",
    syncedAtMs: 0,
  };
}

function getRuntimeStatusMessage({ desynced, parsed, queueLoaded, timerCount }) {
  if (desynced) {
    return "Out of sync";
  }

  if (!queueLoaded) {
    return timerCount ? "Preset not loaded" : "Queue not loaded";
  }

  if (parsed.state === "IDLE") {
    return "Queued and idle";
  }

  return parsed.state === RUNNING_TIMER_STATE ? "Running" : parsed.state;
}
