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
import {
  loadStoredWidgetConfig,
  saveStoredWidgetConfig,
  useStoredWidgetConfig,
} from "../widgetConfigStore.js";

export const DEFAULT_TRIGGER_ACTION_OPTIONS = Object.freeze([
  Object.freeze({ id: "out-on", name: "Output On", scpiCommand: "OUT_ON,CH1" }),
  Object.freeze({ id: "out-off", name: "Output Off", scpiCommand: "OUT_OFF,CH1" }),
  Object.freeze({ id: "out-toggle", name: "Output Toggle", scpiCommand: "OUT_TOGGLE,CH1" }),
  Object.freeze({ id: "tim-start", name: "Timer Start", scpiCommand: "TIM_START,CH1" }),
  Object.freeze({ id: "tim-pause", name: "Timer Pause", scpiCommand: "TIM_PAUSE,CH1" }),
  Object.freeze({ id: "tim-toggle", name: "Timer Toggle", scpiCommand: "TIM_TOGGLE,CH1" }),
]);

export const DEFAULT_EXTERNAL_TRIGGER_CONTROL_CONFIG = Object.freeze({
  type: "externalTriggerControl",
  deviceName: "",
  cardName: "External Triggers",
  statusQueryTemplate: "",
  setupCommandTemplate: "",
  clearTriggerValue: "NONE",
  actionOptions: [],
});

const ACTION_NAME_MAX_LEN = 48;
const ACTION_ID_MAX_LEN = 48;
const ACTION_COMMAND_MAX_LEN = 64;

export function loadExternalTriggerControlConfig(widgetId) {
  return normalizeExternalTriggerControlConfig(loadStoredWidgetConfig(widgetId));
}

export function saveExternalTriggerControlConfig(widgetId, config) {
  const normalized = normalizeExternalTriggerControlConfig({ ...config, type: "externalTriggerControl" });
  return saveStoredWidgetConfig(widgetId, normalized);
}

export function useExternalTriggerControlConfig(widgetId) {
  return useStoredWidgetConfig(widgetId, loadExternalTriggerControlConfig);
}

export function normalizeExternalTriggerControlConfig(candidate) {
  if (!candidate || typeof candidate !== "object" || candidate.type !== "externalTriggerControl") {
    return cloneDefaultExternalTriggerControlConfig();
  }

  const statusQueryTemplate = normalizeScpiQuery(candidate.statusQueryTemplate);
  const setupCommandTemplate = normalizeScpiCommand(candidate.setupCommandTemplate);

  return {
    type: "externalTriggerControl",
    deviceName: String(candidate.deviceName || "").trim(),
    cardName: String(candidate.cardName || DEFAULT_EXTERNAL_TRIGGER_CONTROL_CONFIG.cardName).trim().slice(0, 48),
    statusQueryTemplate:
      validateTriggerStatusQueryTemplate(statusQueryTemplate) ? "" : statusQueryTemplate,
    setupCommandTemplate:
      validateTriggerSetupCommandTemplate(setupCommandTemplate) ? "" : setupCommandTemplate,
    clearTriggerValue: normalizeClearTriggerValue(candidate.clearTriggerValue),
    actionOptions: normalizeActionOptions(candidate.actionOptions),
  };
}

export function normalizeClearTriggerValue(value) {
  const normalized = normalizeScpiCommand(value).slice(0, ACTION_COMMAND_MAX_LEN);
  if (!normalized || validateScpiCommand(normalized)) {
    return DEFAULT_EXTERNAL_TRIGGER_CONTROL_CONFIG.clearTriggerValue;
  }

  return normalized;
}

export function validateTriggerStatusQueryTemplate(value) {
  const normalized = normalizeScpiQuery(value);
  if (!normalized) {
    return "Enter a trigger status query template.";
  }

  if (!normalized.includes("{trigger}") || !normalized.includes("{state}")) {
    return "Status query template must include {trigger} and {state}.";
  }

  return validateScpiQuery(
    normalized
      .replaceAll("{trigger}", "1")
      .replaceAll("{state}", "LOW"),
  );
}

export function validateTriggerSetupCommandTemplate(value) {
  const normalized = normalizeScpiCommand(value);
  if (!normalized) {
    return "Enter a trigger setup command template.";
  }

  if (!normalized.includes("{trigger}") || !normalized.includes("{state}") || !normalized.includes("{command}")) {
    return "Setup command template must include {trigger}, {state}, and {command}.";
  }

  return validateScpiCommand(
    normalized
      .replaceAll("{trigger}", "1")
      .replaceAll("{state}", "LOW")
      .replaceAll("{command}", "OUT_ON,CH1"),
  );
}

function normalizeActionOptions(candidate) {
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate
    .map((item, index) => normalizeActionOption(item, index))
    .filter(Boolean);
}

function normalizeActionOption(candidate, index) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const name = String(candidate.name || "").trim().slice(0, ACTION_NAME_MAX_LEN);
  const scpiCommand = normalizeScpiCommand(candidate.scpiCommand).slice(0, ACTION_COMMAND_MAX_LEN);
  const id = String(candidate.id || `action-${index + 1}`).trim().slice(0, ACTION_ID_MAX_LEN) || `action-${index + 1}`;

  if (!name || validateScpiCommand(scpiCommand)) {
    return null;
  }

  return {
    id,
    name,
    scpiCommand,
  };
}

function cloneDefaultExternalTriggerControlConfig() {
  return {
    ...DEFAULT_EXTERNAL_TRIGGER_CONTROL_CONFIG,
    actionOptions: [],
  };
}
