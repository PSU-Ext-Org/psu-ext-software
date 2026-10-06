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
import { normalizeFrequency } from "../../singleValue/singleValueConfig.js";
import { validateScpiQuery } from "../../../../connection/ws-proxy/scpi/scpiQueryValidation.js";
import { MAX_CHART_HISTORY_BYTES } from "../../chart/storage/chartHistoryStorage.js";
import { MAX_PAIR_TIMEOUT_MS, MIN_PAIR_TIMEOUT_MS, XY_AXES } from "../xyChartConfig.js";

/**
 * @param {import("../xyChartConfig.js").DEFAULT_XY_CHART_CONFIG} draft - Settings draft; numeric fields may still be strings.
 * @returns {string[]} Validation errors, empty when the draft can be saved.
 */
export function validateXyChartDraft(draft) {
  const errors = [];

  for (const axis of XY_AXES) {
    const name = axis.toUpperCase();
    if (!String(draft[axis]?.deviceName || "").trim()) {
      errors.push(`Select a device for ${name}.`);
    }

    const queryError = validateScpiQuery(draft[axis]?.query);
    if (queryError) {
      errors.push(`${name}: ${queryError}`);
    }
  }

  if (Number.parseFloat(draft.frequencyHz) !== normalizeFrequency(draft.frequencyHz)) {
    errors.push("Frequency must be between 0.1 Hz and 100 Hz.");
  }

  if (!isIntegerInRange(draft.pairTimeoutMs, MIN_PAIR_TIMEOUT_MS, MAX_PAIR_TIMEOUT_MS)) {
    errors.push(`Pair timeout must be between ${MIN_PAIR_TIMEOUT_MS} ms and ${MAX_PAIR_TIMEOUT_MS} ms.`);
  }

  const historyLimitBytes = Number.parseInt(String(draft.historyLimitBytes ?? ""), 10);
  if (!Number.isFinite(historyLimitBytes) || historyLimitBytes < 1024 || historyLimitBytes > MAX_CHART_HISTORY_BYTES) {
    errors.push(`History cap must be between 1 KiB and ${MAX_CHART_HISTORY_BYTES / 1024} KiB.`);
  }

  return errors;
}

/**
 * Picks the most relevant one-line status for a configured X-Y chart.
 *
 * @param {object} params
 * @param {import("../xyChartConfig.js").DEFAULT_XY_CHART_CONFIG} params.config
 * @param {Array<{id: string, name: string}>} params.devices
 * @param {Record<string, {state?: string}>} params.deviceStatuses
 * @param {{x: {updatedAt: number, loading: boolean, error: string}, y: {updatedAt: number, loading: boolean, error: string}}} params.snapshots
 * @param {boolean} params.wsConnected
 * @returns {string}
 */
export function getXyStatusText({ config, devices, deviceStatuses, snapshots, wsConnected }) {
  if (!wsConnected) {
    return "WebSocket offline";
  }

  for (const axis of XY_AXES) {
    const name = axis.toUpperCase();
    const device = devices.find((candidate) => candidate.name === config[axis].deviceName);
    if (!device) {
      return `${name}: device unavailable`;
    }

    if (deviceStatuses[device.id]?.state !== "CONNECTED") {
      return `${name}: device disconnected`;
    }
  }

  for (const axis of XY_AXES) {
    if (snapshots[axis]?.error) {
      return `${axis.toUpperCase()}: ${snapshots[axis].error}`;
    }
  }

  if (!snapshots.x?.updatedAt || !snapshots.y?.updatedAt) {
    return snapshots.x?.loading || snapshots.y?.loading ? "Loading" : "Waiting";
  }

  return `${config.y.query} vs ${config.x.query}`;
}

/**
 * @param {import("../xyChartConfig.js").DEFAULT_XY_CHART_CONFIG} config
 * @returns {string} Device names of the two axes, collapsed when they are the same.
 */
export function getXyTargetText(config) {
  return [...new Set(XY_AXES.map((axis) => config[axis].deviceName))].join(" / ");
}

function isIntegerInRange(value, min, max) {
  const text = String(value ?? "").trim();
  const parsed = Number.parseInt(text, 10);
  return /^\d+$/.test(text) && parsed >= min && parsed <= max;
}
