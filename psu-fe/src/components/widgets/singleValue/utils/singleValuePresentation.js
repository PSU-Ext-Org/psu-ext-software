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
import { normalizeScpiQuery, validateScpiQuery } from "../../../../connection/ws-proxy/scpi/scpiQueryValidation.js";
import { validateSetValueConfig } from "./singleValueCommands.js";
import { normalizeFrequency } from "../singleValueConfig.js";

/**
 * Validates polling settings and, when enabled, the optional write settings.
 *
 * @param {object} draft - Editable widget configuration before normalization.
 * @returns {string[]} Validation messages in settings order.
 */
export function validateDraft(draft) {
  const errors = [];
  const frequency = normalizeFrequency(draft.frequencyHz);
  const queryError = validateScpiQuery(draft.query);

  if (!String(draft.deviceName || "").trim()) {
    errors.push("Select a target device.");
  }

  if (queryError) {
    errors.push(queryError);
  }

  if (Number.parseFloat(draft.frequencyHz) !== frequency) {
    errors.push("Frequency must be between 0.1 Hz and 100 Hz.");
  }

  if (draft.setValueEnabled) {
    const writeError = validateSetValueConfig(draft);

    if (writeError) {
      errors.push(writeError);
    }
  }

  return errors;
}

/**
 * Returns the first issue preventing measurement polling, independent of write settings.
 *
 * @param {{deviceName: string, query: string}} config
 * @returns {string} Validation message, or an empty string when polling is configured.
 */
export function validateRunnableConfig(config) {
  if (!config.deviceName || !config.query) {
    return "Configure this card.";
  }

  return validateScpiQuery(config.query);
}

/**
 * Formats the highest-priority connection or measurement status for the value card.
 *
 * @param {object} options
 * @param {{query: string}} options.config
 * @param {object | undefined} options.device - Device matching the configured name.
 * @param {boolean} options.deviceConnected
 * @param {{loading: boolean, value: string, error: string, updatedAt: number}} options.snapshot
 * @param {string} options.validationError
 * @param {boolean} options.wsConnected
 * @returns {string} User-facing card status.
 */
export function getStatusText({ config, device, deviceConnected, snapshot, validationError, wsConnected }) {
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

  if (snapshot.loading && !snapshot.value) {
    return "Loading";
  }

  if (snapshot.error) {
    return snapshot.error;
  }

  if (snapshot.updatedAt) {
    return normalizeScpiQuery(config.query);
  }

  return "Waiting";
}
