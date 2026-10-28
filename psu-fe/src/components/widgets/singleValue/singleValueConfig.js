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
  normalizeScpiQuery,
  validateScpiQuery,
} from "../../../connection/ws-proxy/scpi/scpiQueryValidation.js";
import {
  loadStoredWidgetConfig,
  loadStoredWidgetConfigs,
  saveStoredWidgetConfig,
  useStoredWidgetConfig,
} from "../widgetConfigStore.js";

export const DEFAULT_SINGLE_VALUE_CONFIG = Object.freeze({
  type: "singleValue",
  deviceName: "",
  query: "",
  frequencyHz: 1,
  unit: "",
  cardName: "Single Value",
  valueColor: "#0f766e",

  // Writes are opt-in; a blank default hides the Default action.
  setValueEnabled: false,
  setValueCommand: "",
  defaultValue: "",
});

const MIN_FREQUENCY_HZ = 0.1;
const MAX_FREQUENCY_HZ = 100;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/**
 * Loads one widget with safe defaults for missing or older persisted settings.
 *
 * @param {string} widgetId - Dashboard placement identifier.
 * @returns {typeof DEFAULT_SINGLE_VALUE_CONFIG} Normalized widget configuration.
 */
export function loadSingleValueConfig(widgetId) {
  return normalizeSingleValueConfig(loadStoredWidgetConfig(widgetId));
}

/**
 * Projects configured measurement queries into the shared scheduler's subscription format.
 * Write commands are explicit actions and never become polling subscriptions.
 *
 * @returns {Array<{widgetId: string, deviceName: string, query: string, frequencyHz: number}>}
 */
export function loadRunnableSingleValueSubscriptions() {
  return Object.entries(loadStoredWidgetConfigs())
    .map(([widgetId, config]) => ({
      widgetId,
      config: normalizeSingleValueConfig(config),
    }))
    .filter(({ config }) => config.deviceName && config.query)
    .map(({ widgetId, config }) => ({
      widgetId,
      deviceName: config.deviceName,
      query: config.query,
      frequencyHz: config.frequencyHz,
    }));
}

/**
 * Normalizes and persists settings for a single dashboard placement.
 *
 * @param {string} widgetId - Dashboard placement identifier.
 * @param {Partial<typeof DEFAULT_SINGLE_VALUE_CONFIG>} config
 * @returns {typeof DEFAULT_SINGLE_VALUE_CONFIG}
 */
export function saveSingleValueConfig(widgetId, config) {
  const normalized = normalizeSingleValueConfig({ ...config, type: "singleValue" });

  return saveStoredWidgetConfig(widgetId, normalized);
}

/**
 * Subscribes to persisted settings changes for the requested dashboard placement.
 *
 * @param {string} widgetId - Dashboard placement identifier.
 * @returns {[typeof DEFAULT_SINGLE_VALUE_CONFIG, (config: typeof DEFAULT_SINGLE_VALUE_CONFIG) => void]}
 */
export function useSingleValueConfig(widgetId) {
  return useStoredWidgetConfig(widgetId, loadSingleValueConfig);
}

/**
 * Supplies defaults, bounds display settings, and preserves optional write configuration.
 * Older records stay read-only unless value setting was explicitly enabled.
 *
 * @param {unknown} candidate
 * @returns {typeof DEFAULT_SINGLE_VALUE_CONFIG}
 */
export function normalizeSingleValueConfig(candidate) {
  if (!candidate || typeof candidate !== "object" || candidate.type !== "singleValue") {
    return { ...DEFAULT_SINGLE_VALUE_CONFIG };
  }

  const frequencyHz = normalizeFrequency(candidate.frequencyHz);
  const valueColor = HEX_COLOR_PATTERN.test(String(candidate.valueColor || ""))
    ? String(candidate.valueColor)
    : DEFAULT_SINGLE_VALUE_CONFIG.valueColor;
  const query = normalizeScpiQuery(candidate.query);

  return {
    type: "singleValue",
    deviceName: String(candidate.deviceName || "").trim(),
    query: validateScpiQuery(query) ? "" : query,
    frequencyHz,
    unit: String(candidate.unit || "").trim().slice(0, 16),
    cardName: String(candidate.cardName || DEFAULT_SINGLE_VALUE_CONFIG.cardName).trim().slice(0, 48),
    valueColor,

    setValueEnabled: candidate.setValueEnabled === true,
    setValueCommand: String(candidate.setValueCommand ?? "").trim(),
    // Nullish conversion preserves numeric zero in imported default values.
    defaultValue: String(candidate.defaultValue ?? "").trim(),
  };
}

/**
 * Clamps a polling frequency to the supported range, falling back for non-numeric input.
 *
 * @param {unknown} value
 * @returns {number}
 */
export function normalizeFrequency(value) {
  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_SINGLE_VALUE_CONFIG.frequencyHz;
  }

  return Math.min(Math.max(parsed, MIN_FREQUENCY_HZ), MAX_FREQUENCY_HZ);
}

export const singleValueWidgetConfigSource = {
  loadRunnableSubscriptions: loadRunnableSingleValueSubscriptions,
};
