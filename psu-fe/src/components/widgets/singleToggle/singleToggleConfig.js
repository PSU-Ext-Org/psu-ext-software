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
import {
  normalizeScpiCommand,
  normalizeScpiQuery,
  validateScpiCommand,
  validateScpiQuery,
} from "../../../connection/ws-proxy/scpi/scpiQueryValidation.js";
import { normalizeFrequency } from "../singleValue/singleValueConfig.js";
import {
  loadStoredWidgetConfig,
  loadStoredWidgetConfigs,
  saveStoredWidgetConfig,
  useStoredWidgetConfig,
} from "../widgetConfigStore.js";

export const DEFAULT_SINGLE_TOGGLE_CONFIG = Object.freeze({
  type: "singleToggle",
  deviceName: "",
  statusCommand: "",
  onCommand: "",
  offCommand: "",
  onResponse: "1",
  offResponse: "0",
  cardName: "Single Toggle",
  statusColor: "#0f766e",
  autoRefreshEnabled: false,
  refreshFrequencyHz: 1,
});

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/**
 * @param {string} widgetId
 * @returns {typeof DEFAULT_SINGLE_TOGGLE_CONFIG}
 */
export function loadSingleToggleConfig(widgetId) {
  return normalizeSingleToggleConfig(loadStoredWidgetConfig(widgetId));
}

/**
 * @returns {Array<{widgetId: string, deviceName: string, query: string, frequencyHz: number}>}
 */
export function loadRunnableSingleToggleSubscriptions() {
  return Object.entries(loadStoredWidgetConfigs())
    .map(([widgetId, config]) => ({
      widgetId,
      config: normalizeSingleToggleConfig(config),
    }))
    .filter(({ config }) => config.autoRefreshEnabled && config.deviceName && config.statusCommand)
    .map(({ widgetId, config }) => ({
      widgetId,
      deviceName: config.deviceName,
      query: config.statusCommand,
      frequencyHz: config.refreshFrequencyHz,
    }));
}

/**
 * @param {string} widgetId
 * @param {Partial<typeof DEFAULT_SINGLE_TOGGLE_CONFIG>} config
 * @returns {typeof DEFAULT_SINGLE_TOGGLE_CONFIG}
 */
export function saveSingleToggleConfig(widgetId, config) {
  const normalized = normalizeSingleToggleConfig({ ...config, type: "singleToggle" });
  return saveStoredWidgetConfig(widgetId, normalized);
}

/**
 * @param {string} widgetId
 * @returns {[typeof DEFAULT_SINGLE_TOGGLE_CONFIG, (config: typeof DEFAULT_SINGLE_TOGGLE_CONFIG) => void]}
 */
export function useSingleToggleConfig(widgetId) {
  return useStoredWidgetConfig(widgetId, loadSingleToggleConfig);
}

/**
 * @param {unknown} candidate
 * @returns {typeof DEFAULT_SINGLE_TOGGLE_CONFIG}
 */
export function normalizeSingleToggleConfig(candidate) {
  if (!candidate || typeof candidate !== "object" || candidate.type !== "singleToggle") {
    return { ...DEFAULT_SINGLE_TOGGLE_CONFIG };
  }

  const statusCommand = normalizeScpiQuery(candidate.statusCommand);
  const onCommand = normalizeScpiCommand(candidate.onCommand);
  const offCommand = normalizeScpiCommand(candidate.offCommand);
  const onResponse = normalizeToggleResponse(candidate.onResponse, DEFAULT_SINGLE_TOGGLE_CONFIG.onResponse);
  const candidateOffResponse = normalizeToggleResponse(
    candidate.offResponse,
    DEFAULT_SINGLE_TOGGLE_CONFIG.offResponse,
  );
  const offResponse =
    onResponse === candidateOffResponse
      ? (onResponse === DEFAULT_SINGLE_TOGGLE_CONFIG.offResponse
        ? DEFAULT_SINGLE_TOGGLE_CONFIG.onResponse
        : DEFAULT_SINGLE_TOGGLE_CONFIG.offResponse)
      : candidateOffResponse;
  const statusColor = HEX_COLOR_PATTERN.test(String(candidate.statusColor || ""))
    ? String(candidate.statusColor)
    : DEFAULT_SINGLE_TOGGLE_CONFIG.statusColor;
  const refreshFrequencyHz = normalizeFrequency(candidate.refreshFrequencyHz);

  return {
    type: "singleToggle",
    deviceName: String(candidate.deviceName || "").trim(),
    statusCommand: validateScpiQuery(statusCommand) ? "" : statusCommand,
    onCommand: validateScpiCommand(onCommand) ? "" : onCommand,
    offCommand: validateScpiCommand(offCommand) ? "" : offCommand,
    onResponse,
    offResponse: onResponse === offResponse ? DEFAULT_SINGLE_TOGGLE_CONFIG.offResponse : offResponse,
    cardName: String(candidate.cardName || DEFAULT_SINGLE_TOGGLE_CONFIG.cardName).trim().slice(0, 48),
    statusColor,
    autoRefreshEnabled: Boolean(candidate.autoRefreshEnabled),
    refreshFrequencyHz,
  };
}

function normalizeToggleResponse(value, fallback) {
  const normalized = String(value ?? "").trim().slice(0, 64);
  return normalized || fallback;
}

export const singleToggleWidgetConfigSource = {
  loadRunnableSubscriptions: loadRunnableSingleToggleSubscriptions,
};
