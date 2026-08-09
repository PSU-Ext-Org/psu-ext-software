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
  saveStoredWidgetConfig,
  useStoredWidgetConfig,
} from "../widgetConfigStore.js";

export const DEFAULT_PROTECTION_CONTROL_CONFIG = Object.freeze({
  type: "protectionControl",
  deviceName: "",
  cardName: "Protection Control",
  valueColor: "#0f766e",
  unit: "",
  channel: "CH1",
  protectionKey: "",
  frequencyHz: 1,
  valueQuery: "",
  valueSetTemplate: "",
  tripQuery: "",
  enableQuery: "",
  enableOnCommand: "",
  enableOffCommand: "",
  enabledResponse: "1",
  disabledResponse: "0",
  minValue: 0,
  maxValue: 9999.9999,
  decimals: 4,
});

const MIN_DECIMALS = 0;
const MAX_DECIMALS = 6;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/**
 * @param {string} widgetId
 * @returns {typeof DEFAULT_PROTECTION_CONTROL_CONFIG}
 */
export function loadProtectionControlConfig(widgetId) {
  return normalizeProtectionControlConfig(loadStoredWidgetConfig(widgetId));
}

/**
 * @param {string} widgetId
 * @param {Partial<typeof DEFAULT_PROTECTION_CONTROL_CONFIG>} config
 * @returns {typeof DEFAULT_PROTECTION_CONTROL_CONFIG}
 */
export function saveProtectionControlConfig(widgetId, config) {
  const normalized = normalizeProtectionControlConfig({ ...config, type: "protectionControl" });
  return saveStoredWidgetConfig(widgetId, normalized);
}

/**
 * @param {string} widgetId
 * @returns {[typeof DEFAULT_PROTECTION_CONTROL_CONFIG, (config: typeof DEFAULT_PROTECTION_CONTROL_CONFIG) => void]}
 */
export function useProtectionControlConfig(widgetId) {
  return useStoredWidgetConfig(widgetId, loadProtectionControlConfig);
}

/**
 * @param {unknown} candidate
 * @returns {typeof DEFAULT_PROTECTION_CONTROL_CONFIG}
 */
export function normalizeProtectionControlConfig(candidate) {
  if (!candidate || typeof candidate !== "object" || candidate.type !== "protectionControl") {
    return { ...DEFAULT_PROTECTION_CONTROL_CONFIG };
  }

  const valueQuery = normalizeScpiQuery(candidate.valueQuery);
  const valueSetTemplate = normalizeScpiCommand(candidate.valueSetTemplate);
  const tripQuery = normalizeScpiQuery(candidate.tripQuery);
  const enableQuery = normalizeScpiQuery(candidate.enableQuery);
  const enableOnCommand = normalizeScpiCommand(candidate.enableOnCommand);
  const enableOffCommand = normalizeScpiCommand(candidate.enableOffCommand);
  const enabledResponse = normalizeToggleResponse(
    candidate.enabledResponse,
    DEFAULT_PROTECTION_CONTROL_CONFIG.enabledResponse,
  );
  const candidateDisabledResponse = normalizeToggleResponse(
    candidate.disabledResponse,
    DEFAULT_PROTECTION_CONTROL_CONFIG.disabledResponse,
  );
  const disabledResponse =
    enabledResponse === candidateDisabledResponse
      ? (enabledResponse === DEFAULT_PROTECTION_CONTROL_CONFIG.disabledResponse
        ? DEFAULT_PROTECTION_CONTROL_CONFIG.enabledResponse
        : DEFAULT_PROTECTION_CONTROL_CONFIG.disabledResponse)
      : candidateDisabledResponse;
  const frequencyHz = normalizeFrequency(candidate.frequencyHz);
  const valueColor = HEX_COLOR_PATTERN.test(String(candidate.valueColor || ""))
    ? String(candidate.valueColor)
    : DEFAULT_PROTECTION_CONTROL_CONFIG.valueColor;
  const minValue = normalizeNumericLimit(candidate.minValue, DEFAULT_PROTECTION_CONTROL_CONFIG.minValue);
  const maxValue = normalizeNumericLimit(candidate.maxValue, DEFAULT_PROTECTION_CONTROL_CONFIG.maxValue);
  const decimals = normalizeDecimals(candidate.decimals);
  const hasEnableConfig = enableQuery || enableOnCommand || enableOffCommand;

  return {
    type: "protectionControl",
    deviceName: String(candidate.deviceName || "").trim(),
    cardName: String(candidate.cardName || DEFAULT_PROTECTION_CONTROL_CONFIG.cardName).trim().slice(0, 48),
    valueColor,
    unit: String(candidate.unit || "").trim().slice(0, 16),
    channel: String(candidate.channel || DEFAULT_PROTECTION_CONTROL_CONFIG.channel).trim().slice(0, 16) ||
      DEFAULT_PROTECTION_CONTROL_CONFIG.channel,
    protectionKey: String(candidate.protectionKey || "").trim().slice(0, 24).toUpperCase(),
    frequencyHz,
    valueQuery: validateScpiQuery(valueQuery) ? "" : valueQuery,
    valueSetTemplate:
      validateScpiCommand(valueSetTemplate.replace("{value}", "1")) ||
        !valueSetTemplate.includes("{value}")
        ? ""
        : valueSetTemplate,
    tripQuery: validateScpiQuery(tripQuery) ? "" : tripQuery,
    enableQuery: hasEnableConfig && !validateScpiQuery(enableQuery) ? enableQuery : "",
    enableOnCommand:
      hasEnableConfig && !validateScpiCommand(enableOnCommand) ? enableOnCommand : "",
    enableOffCommand:
      hasEnableConfig && !validateScpiCommand(enableOffCommand) ? enableOffCommand : "",
    enabledResponse,
    disabledResponse,
    minValue: Math.min(minValue, maxValue),
    maxValue: Math.max(minValue, maxValue),
    decimals,
  };
}

function normalizeToggleResponse(value, fallback) {
  const normalized = String(value ?? "").trim().slice(0, 64);
  return normalized || fallback;
}

function normalizeNumericLimit(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeDecimals(value) {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) {
    return DEFAULT_PROTECTION_CONTROL_CONFIG.decimals;
  }

  return Math.min(Math.max(parsed, MIN_DECIMALS), MAX_DECIMALS);
}
