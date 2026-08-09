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
import { normalizeFrequency } from "../../singleValue/singleValueConfig.js";
import { MAX_CHART_HISTORY_BYTES } from "../storage/chartHistoryStorage.js";

/**
 * @param {import("../chartConfig.js").DEFAULT_CHART_CONFIG} draft
 * @returns {string[]}
 */
export function validateChartDraft(draft) {
  const errors = [];
  const frequency = normalizeFrequency(draft.frequencyHz);
  const series = draft.series[0] || {};
  const queryError = validateScpiQuery(series.query);

  if (!String(series.deviceName || "").trim()) {
    errors.push("Select a target device.");
  }

  if (queryError) {
    errors.push(queryError);
  }

  if (Number.parseFloat(draft.frequencyHz) !== frequency) {
    errors.push("Frequency must be between 0.1 Hz and 100 Hz.");
  }

  const historyLimitBytes = Number.parseInt(String(draft.historyLimitBytes ?? ""), 10);
  if (!Number.isFinite(historyLimitBytes) || historyLimitBytes < 1024 || historyLimitBytes > MAX_CHART_HISTORY_BYTES) {
    errors.push("History cap must be between 1 KiB and 256 KiB.");
  }

  return errors;
}

/**
 * @param {{deviceName?: string, query?: string} | undefined} series
 * @returns {string}
 */
export function validateRunnableSeries(series) {
  if (!series?.deviceName || !series?.query) {
    return "Configure this chart.";
  }

  return validateScpiQuery(series.query);
}

/**
 * @param {object} params
 * @param {{id?: string} | undefined} params.device
 * @param {boolean} params.deviceConnected
 * @param {{query: string}} params.series
 * @param {{value: string, updatedAt: number, loading: boolean, error: string} | undefined} params.snapshot
 * @param {string} params.validationError
 * @param {boolean} params.wsConnected
 * @returns {string}
 */
export function getStatusText({ device, deviceConnected, series, snapshot, validationError, wsConnected }) {
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

  if (snapshot?.loading && !snapshot.value) {
    return "Loading";
  }

  if (snapshot?.error) {
    return snapshot.error;
  }

  if (snapshot?.updatedAt) {
    return normalizeScpiQuery(series.query);
  }

  return "Waiting";
}
