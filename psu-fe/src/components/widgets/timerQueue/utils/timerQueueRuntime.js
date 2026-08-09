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
import { MONITOR_TAG } from "../../../../connection/ws-proxy/monitor/monitorTagQueue.js";
import { parseDurationSecondsToMs, validateTimerQueueControlConfig } from "../timerQueueConfig.js";

export const INITIAL_TIMER_QUEUE_RUNTIME = Object.freeze({
  activeId: "NONE",
  state: "IDLE",
  remainingMs: 0,
  syncedAtMs: 0,
  queueLoaded: false,
  desynced: false,
  loading: false,
  message: "Queue not loaded",
  error: "",
});

export const RUNNING_TIMER_STATE = "RUNNING";
export const RESUMABLE_TIMER_STATES = new Set(["PAUSED", "OVP", "OCP", "OVR"]);

const EMPTY_STATUS_RESPONSE = "NONE,IDLE,0.000";

export function createRuntimeFromStatusResponse(response, configuredTimers) {
  const parsed = parseTimerStatusResponse(response);
  const activeTimer = configuredTimers.find((timer) => timer.id === parsed.activeId) || null;
  const queueLoaded = parsed.activeId !== "NONE";
  const desynced = queueLoaded && !activeTimer;

  return {
    activeId: parsed.activeId,
    state: parsed.state,
    remainingMs: parsed.remainingMs,
    syncedAtMs: parsed.state === RUNNING_TIMER_STATE ? Date.now() : 0,
    queueLoaded,
    desynced,
    message: desynced
      ? "Out of sync"
      : queueLoaded
        ? parsed.state === "IDLE"
          ? "Queued and idle"
          : parsed.state === RUNNING_TIMER_STATE
            ? "Running"
            : parsed.state
        : configuredTimers.length
          ? "Preset not loaded"
          : "Queue not loaded",
    error: "",
  };
}

export function parseTimerStatusResponse(response) {
  const normalized = String(response || "").trim() || EMPTY_STATUS_RESPONSE;
  const [activeId = "NONE", state = "IDLE", remainingText = "0.000"] = normalized.split(",");

  return {
    activeId: String(activeId || "NONE").trim() || "NONE",
    state: String(state || "IDLE").trim() || "IDLE",
    remainingMs: parseTimerRemainingToMs(remainingText),
  };
}

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

export function getTimerActionLabel(runtime) {
  if (runtime.state === RUNNING_TIMER_STATE) {
    return "Pause";
  }

  if (RESUMABLE_TIMER_STATES.has(runtime.state) && runtime.queueLoaded) {
    return "Resume";
  }

  return "Load and start";
}

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

export function formatRemaining(remainingMs) {
  const safeRemainingMs = Math.max(0, Number(remainingMs) || 0);
  const totalSeconds = Math.floor(safeRemainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = safeRemainingMs % 1000;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

export function sendTimerQueueCommand(sendScpiCommand, deviceName, command) {
  return sendScpiCommand(command, deviceName, {
    tag: MONITOR_TAG.GUI,
    waitForResponse: true,
  });
}

export function buildNonRunnableRuntimeMessage({ wsConnected, device }) {
  if (!wsConnected) {
    return "WebSocket offline";
  }

  if (!device) {
    return "Device unavailable";
  }

  return "Device disconnected";
}

export async function runTimerQueueAction({
  config,
  displayedRemainingMs,
  runtime,
  sendScpiCommand,
}) {
  const currentConfigError = validateTimerQueueControlConfig(config);
  if (currentConfigError) {
    return {
      kind: "error",
      error: currentConfigError,
      message: currentConfigError,
    };
  }

  if (runtime.state === RUNNING_TIMER_STATE) {
    await sendTimerQueueCommand(sendScpiCommand, config.deviceName, "TIM:PAUSE CH1");
    return {
      kind: "runtime",
      runtime: {
        ...runtime,
        state: "PAUSED",
        remainingMs: displayedRemainingMs,
        syncedAtMs: 0,
        loading: false,
        message: "Paused",
        error: "",
      },
    };
  }

  if (RESUMABLE_TIMER_STATES.has(runtime.state) && runtime.queueLoaded) {
    await sendTimerQueueCommand(sendScpiCommand, config.deviceName, "TIM:START CH1");
    return {
      kind: "runtime",
      runtime: {
        ...runtime,
        state: RUNNING_TIMER_STATE,
        remainingMs: displayedRemainingMs,
        syncedAtMs: Date.now(),
        loading: false,
        message: "Running",
        error: "",
      },
    };
  }

  await sendTimerQueueCommand(sendScpiCommand, config.deviceName, "TIM:CLE CH1");
  for (const timer of config.timers) {
    await sendTimerQueueCommand(
      sendScpiCommand,
      config.deviceName,
      `TIM:ADD CH1,${timer.id},${timer.durationSeconds},${timer.relayOnAfterExpiry ? "1" : "0"}`,
    );
  }
  await sendTimerQueueCommand(sendScpiCommand, config.deviceName, "TIM:START CH1");

  const firstTimer = config.timers[0];
  return {
    kind: "runtime",
    runtime: {
      activeId: firstTimer.id,
      state: RUNNING_TIMER_STATE,
      remainingMs: parseDurationSecondsToMs(firstTimer.durationSeconds) || 0,
      syncedAtMs: Date.now(),
      queueLoaded: true,
      desynced: false,
      loading: false,
      message: "Running",
      error: "",
    },
  };
}

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
      state: RUNNING_TIMER_STATE,
      remainingMs: parseDurationSecondsToMs(nextTimer.durationSeconds) || 0,
      syncedAtMs: Date.now(),
      queueLoaded: true,
      desynced: false,
      message: "Running",
      error: "",
    };
  }

  return {
    ...runtime,
    activeId: "NONE",
    state: "IDLE",
    remainingMs: 0,
    syncedAtMs: 0,
    queueLoaded: false,
    desynced: false,
    message: "Queue complete",
    error: "",
  };
}
