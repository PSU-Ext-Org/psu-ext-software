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

const pendingAutoStatusChecks = new Map();

/** Forgets a disconnected widget's pending automatic status read. */
export function forgetAutoStatusCheck(widgetId, config) {
  pendingAutoStatusChecks.delete(createAutoStatusKey(widgetId, config));
}

/** Sends a GUI command and waits for its matching response. */
export function sendToggleCommand(sendScpiCommand, deviceName, command) {
  return sendScpiCommand(command, deviceName, {
    tag: MONITOR_TAG.GUI,
    waitForResponse: true,
  });
}

/** Shares an automatic status request across StrictMode remounts. */
export function runStatusCommand({ autoStatusKey, command, deviceName, sendScpiCommand }) {
  if (!autoStatusKey) {
    return sendToggleCommand(sendScpiCommand, deviceName, command);
  }

  const pending = pendingAutoStatusChecks.get(autoStatusKey);
  if (pending) {
    return pending;
  }

  const nextPending = sendToggleCommand(sendScpiCommand, deviceName, command).finally(() => {
    if (pendingAutoStatusChecks.get(autoStatusKey) === nextPending) {
      pendingAutoStatusChecks.delete(autoStatusKey);
    }
  });
  pendingAutoStatusChecks.set(autoStatusKey, nextPending);
  return nextPending;
}

/** Identifies automatic status reads by widget and response mapping. */
export function createAutoStatusKey(widgetId, config) {
  return [
    widgetId,
    config.deviceName,
    config.statusCommand,
    config.onResponse,
    config.offResponse,
  ].join("\u001f");
}

/** Rejects commands when the connection API is unavailable. */
export function missingSendScpiCommand() {
  return Promise.reject(new Error("SCPI command sender is unavailable."));
}
