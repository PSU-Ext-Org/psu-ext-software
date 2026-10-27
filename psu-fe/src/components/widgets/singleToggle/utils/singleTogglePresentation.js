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
import { validateScpiCommand, validateScpiQuery } from "../../../../connection/ws-proxy/scpi/scpiQueryValidation.js";
import { normalizeFrequency } from "../../singleValue/singleValueConfig.js";

/** Validates commands, response mappings, and optional polling settings. */
export function validateDraft(draft) {
  const errors = [];
  const statusError = validateScpiQuery(draft.statusCommand);
  const onError = validateScpiCommand(draft.onCommand);
  const offError = validateScpiCommand(draft.offCommand);
  const onResponse = String(draft.onResponse || "").trim();
  const offResponse = String(draft.offResponse || "").trim();
  const refreshFrequency = normalizeFrequency(draft.refreshFrequencyHz);

  if (!String(draft.deviceName || "").trim()) {
    errors.push("Select a target device.");
  }

  if (statusError) {
    errors.push(statusError);
  }

  if (onError) {
    errors.push(onError);
  }

  if (offError) {
    errors.push(offError);
  }

  if (!onResponse || !offResponse) {
    errors.push("Enter on and off response mappings.");
  }

  if (onResponse && onResponse === offResponse) {
    errors.push("On and off responses must be different.");
  }

  if (draft.autoRefreshEnabled && Number.parseFloat(draft.refreshFrequencyHz) !== refreshFrequency) {
    errors.push("Frequency must be between 0.1 Hz and 100 Hz.");
  }

  return errors;
}

/** Returns the first issue preventing toggle operations. */
export function validateRunnableConfig(config) {
  if (!config.deviceName || !config.statusCommand || !config.onCommand || !config.offCommand) {
    return "Configure this toggle.";
  }

  return (
    validateScpiQuery(config.statusCommand) ||
    validateScpiCommand(config.onCommand) ||
    validateScpiCommand(config.offCommand)
  );
}

/** Maps a device response to the configured binary state. */
export function mapStatusResponse(response, config) {
  const normalizedResponse = String(response ?? "").trim();
  if (normalizedResponse === String(config.onResponse).trim()) {
    return "on";
  }

  if (normalizedResponse === String(config.offResponse).trim()) {
    return "off";
  }

  return "unknown";
}

/** Formats connection, command, and polling feedback for the toggle card. */
export function getHelperText({
  autoRefreshEnabled,
  device,
  deviceConnected,
  snapshot,
  status,
  validationError,
  wsConnected,
}) {
  if (validationError) {
    return validationError;
  }

  if (!wsConnected) {
    return "WebSocket offline";
  }

  if (!device) {
    return "Device unavailable";
  }

  if (!deviceConnected) {
    return "Device disconnected";
  }

  if (status.busy) {
    return status.message;
  }

  if (autoRefreshEnabled) {
    if (snapshot.loading && status.state === "unknown" && !snapshot.updatedAt) {
      return "Checking status";
    }

    if (snapshot.error) {
      return snapshot.error;
    }
  }

  return status.message;
}

/** Returns display text and the action label for the currently available toggle state. */
export function getToggleDisplay(state, runnable) {
  if (!runnable) {
    return { displayText: "--", actionLabel: "Check" };
  }
  const labels = {
    on: { displayText: "ON", actionLabel: "Turn off" },
    off: { displayText: "OFF", actionLabel: "Turn on" },
  };
  return labels[state] || { displayText: "--", actionLabel: "Check" };
}
