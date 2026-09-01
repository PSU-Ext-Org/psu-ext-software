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
import {
  parseDurationSecondsToMs,
  TIMER_QUEUE_CHANNEL,
  validateTimerQueueControlConfig,
} from "../timerQueueConfig.js";
import { RESUMABLE_TIMER_STATES, RUNNING_TIMER_STATE } from "./timerQueueStatus.js";

/**
 * Sends one timer command through the GUI monitor channel.
 *
 * @param {Function} sendScpiCommand - WebSocket SCPI command sender.
 * @param {string} deviceName - Selected target device.
 * @param {string} command - Complete SCPI command.
 * @returns {Promise<object>} Device response.
 */
export function sendTimerQueueCommand(sendScpiCommand, deviceName, command) {
  return sendScpiCommand(command, deviceName, {
    tag: MONITOR_TAG.GUI,
    waitForResponse: true,
  });
}

/**
 * Executes the pause, resume, or upload-and-start workflow for a timer preset.
 *
 * @param {{config: object, displayedRemainingMs: number, runtime: object, sendScpiCommand: Function}} context - Current timer runtime and command adapter.
 * @returns {Promise<{kind: "error" | "runtime", error?: string, message?: string, runtime?: object}>} Resulting local runtime state.
 */
export async function runTimerQueueAction({ config, displayedRemainingMs, runtime, sendScpiCommand }) {
  const currentConfigError = validateTimerQueueControlConfig(config);
  if (currentConfigError) {
    return {
      error: currentConfigError,
      kind: "error",
      message: currentConfigError,
    };
  }

  if (runtime.state === RUNNING_TIMER_STATE) {
    await sendTimerQueueCommand(sendScpiCommand, config.deviceName, `TIM:PAUSE ${TIMER_QUEUE_CHANNEL}`);
    return {
      kind: "runtime",
      runtime: {
        ...runtime,
        error: "",
        loading: false,
        message: "Paused",
        remainingMs: displayedRemainingMs,
        state: "PAUSED",
        syncedAtMs: 0,
      },
    };
  }

  if (RESUMABLE_TIMER_STATES.has(runtime.state) && runtime.queueLoaded) {
    await sendTimerQueueCommand(sendScpiCommand, config.deviceName, `TIM:START ${TIMER_QUEUE_CHANNEL}`);
    return {
      kind: "runtime",
      runtime: {
        ...runtime,
        error: "",
        loading: false,
        message: "Running",
        remainingMs: displayedRemainingMs,
        state: RUNNING_TIMER_STATE,
        syncedAtMs: Date.now(),
      },
    };
  }

  await sendTimerQueueCommand(sendScpiCommand, config.deviceName, `TIM:CLE ${TIMER_QUEUE_CHANNEL}`);
  for (const timer of config.timers) {
    await sendTimerQueueCommand(
      sendScpiCommand,
      config.deviceName,
      `TIM:ADD ${TIMER_QUEUE_CHANNEL},${timer.id},${timer.durationSeconds},${timer.relayOnAfterExpiry ? "1" : "0"}`,
    );
  }
  await sendTimerQueueCommand(sendScpiCommand, config.deviceName, `TIM:START ${TIMER_QUEUE_CHANNEL}`);

  const firstTimer = config.timers[0];
  return {
    kind: "runtime",
    runtime: {
      activeId: firstTimer.id,
      desynced: false,
      error: "",
      loading: false,
      message: "Running",
      queueLoaded: true,
      remainingMs: parseDurationSecondsToMs(firstTimer.durationSeconds) || 0,
      state: RUNNING_TIMER_STATE,
      syncedAtMs: Date.now(),
    },
  };
}
