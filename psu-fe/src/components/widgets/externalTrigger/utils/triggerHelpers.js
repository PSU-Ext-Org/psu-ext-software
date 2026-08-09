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
  DEFAULT_EXTERNAL_TRIGGER_CONTROL_CONFIG,
  DEFAULT_TRIGGER_ACTION_OPTIONS,
  validateTriggerSetupCommandTemplate,
  validateTriggerStatusQueryTemplate,
} from "../triggerConfig.js";
import { validateScpiCommand } from "../../../../connection/ws-proxy/scpi/scpiQueryValidation.js";

export const TRIGGER_SLOT_DEFINITIONS = Object.freeze([
  Object.freeze({ key: "1:LOW", trigger: "1", state: "LOW", triggerLabel: "T1", label: "LOW" }),
  Object.freeze({ key: "1:HIGH", trigger: "1", state: "HIGH", triggerLabel: "T1", label: "HIGH" }),
  Object.freeze({ key: "2:LOW", trigger: "2", state: "LOW", triggerLabel: "T2", label: "LOW" }),
  Object.freeze({ key: "2:HIGH", trigger: "2", state: "HIGH", triggerLabel: "T2", label: "HIGH" }),
]);

export const INITIAL_TRIGGER_RUNTIME_STATE = Object.freeze({
  slots: Object.freeze({
    "1:LOW": "",
    "1:HIGH": "",
    "2:LOW": "",
    "2:HIGH": "",
  }),
  loading: false,
  error: "",
  lastUpdatedAt: 0,
});

export function validateDraftConfig(draft) {
  const errors = [];
  const statusQueryError = validateTriggerStatusQueryTemplate(draft.statusQueryTemplate);
  const setupCommandError = validateTriggerSetupCommandTemplate(draft.setupCommandTemplate);

  if (!String(draft.deviceName || "").trim()) {
    errors.push("Select a target device.");
  }

  if (statusQueryError) {
    errors.push(statusQueryError);
  }

  if (setupCommandError) {
    errors.push(setupCommandError);
  }

  const clearValueError = validateClearTriggerValue(draft.clearTriggerValue);
  if (clearValueError) {
    errors.push(clearValueError);
  }

  const optionValidationError = validateActionOptions(draft.actionOptions, draft.clearTriggerValue);
  if (optionValidationError) {
    errors.push(optionValidationError);
  }

  return errors;
}

export function validateRunnableConfig(config) {
  if (!config.deviceName || !config.statusQueryTemplate || !config.setupCommandTemplate) {
    return "Configure trigger queries and setup command.";
  }

  return (
    validateTriggerStatusQueryTemplate(config.statusQueryTemplate) ||
    validateTriggerSetupCommandTemplate(config.setupCommandTemplate) ||
    validateClearTriggerValue(config.clearTriggerValue) ||
    validateActionOptions(config.actionOptions, config.clearTriggerValue)
  );
}

export function validateClearTriggerValue(clearTriggerValue) {
  const error = validateScpiCommand(String(clearTriggerValue || "").trim());
  return error || "";
}

export function validateActionOptions(actionOptions, clearTriggerValue) {
  if (!Array.isArray(actionOptions)) {
    return "Trigger action options must be a list.";
  }

  const names = new Set();
  const commands = new Set();
  const reservedClearValue = normalizeTriggerScpiPayload(
    clearTriggerValue,
    DEFAULT_EXTERNAL_TRIGGER_CONTROL_CONFIG.clearTriggerValue,
  );

  for (const option of actionOptions) {
    const name = String(option?.name || "").trim();
    const scpiCommand = String(option?.scpiCommand || "").trim();

    if (!name) {
      return "Every trigger action needs a name.";
    }

    const scpiCommandError = validateScpiCommand(scpiCommand);
    if (scpiCommandError) {
      return scpiCommandError;
    }

    const normalizedName = name.toUpperCase();
    const normalizedCommand = normalizeTriggerScpiPayload(
      scpiCommand,
      DEFAULT_EXTERNAL_TRIGGER_CONTROL_CONFIG.clearTriggerValue,
    );
    if (normalizedCommand === reservedClearValue) {
      return "Clear trigger value is reserved for the built-in unassigned option.";
    }

    if (names.has(normalizedName)) {
      return "Trigger action names must be unique.";
    }

    if (commands.has(normalizedCommand)) {
      return "Trigger action SCPI commands must be unique.";
    }

    names.add(normalizedName);
    commands.add(normalizedCommand);
  }

  return "";
}

export function getExternalTriggerCardName(config) {
  return String(config.cardName || "").trim() || DEFAULT_EXTERNAL_TRIGGER_CONTROL_CONFIG.cardName;
}

export function getStatusText({ device, deviceConnected, runtime, validationError, wsConnected }) {
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

  if (runtime.loading) {
    return "Refreshing";
  }

  return runtime.error || "Ready";
}

export function normalizeTriggerScpiPayload(value, clearTriggerValue = DEFAULT_EXTERNAL_TRIGGER_CONTROL_CONFIG.clearTriggerValue) {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  const normalizedClearValue = String(clearTriggerValue ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  return normalized || normalizedClearValue || DEFAULT_EXTERNAL_TRIGGER_CONTROL_CONFIG.clearTriggerValue;
}

export function getSlotDisplayValue(rawValue, actionOptions, clearTriggerValue) {
  const normalizedValue = normalizeTriggerScpiPayload(rawValue, clearTriggerValue);
  const normalizedClearValue = normalizeTriggerScpiPayload(clearTriggerValue, clearTriggerValue);
  if (normalizedValue === normalizedClearValue) {
    return {
      actionName: "None",
      commandLabel: "None",
      selectValue: clearTriggerValue,
      isMapped: true,
    };
  }

  const mapped = actionOptions.find(
    (candidate) => normalizeTriggerScpiPayload(candidate.scpiCommand, clearTriggerValue) === normalizedValue,
  );
  if (mapped) {
    return {
      actionName: mapped.name,
      commandLabel: mapped.scpiCommand,
      selectValue: mapped.scpiCommand,
      isMapped: true,
    };
  }

  return {
    actionName: "Custom",
    commandLabel: String(rawValue || "").trim() || "None",
    selectValue: String(rawValue || "").trim() || clearTriggerValue,
    isMapped: false,
  };
}

export function buildSelectOptions(actionOptions, slotValue, clearTriggerValue) {
  const options = [
    { value: clearTriggerValue, label: "None" },
    ...actionOptions.map((option) => ({
      value: option.scpiCommand,
      label: option.name,
    })),
  ];
  const normalizedCurrent = normalizeTriggerScpiPayload(slotValue, clearTriggerValue);
  const normalizedClearValue = normalizeTriggerScpiPayload(clearTriggerValue, clearTriggerValue);
  const exists = options.some((option) => normalizeTriggerScpiPayload(option.value, clearTriggerValue) === normalizedCurrent);
  if (!exists && normalizedCurrent !== normalizedClearValue) {
    options.push({
      value: String(slotValue).trim(),
      label: `Custom: ${String(slotValue).trim()}`,
    });
  }

  return options;
}

export function applyDefaultTriggerConfig(draft) {
  return {
    ...draft,
    cardName: String(draft.cardName || "").trim() || DEFAULT_EXTERNAL_TRIGGER_CONTROL_CONFIG.cardName,
    statusQueryTemplate: "TRIG:CONF? {trigger},{state}",
    setupCommandTemplate: "TRIG:CONF {trigger},{state},{command}",
    clearTriggerValue: DEFAULT_EXTERNAL_TRIGGER_CONTROL_CONFIG.clearTriggerValue,
    actionOptions: DEFAULT_TRIGGER_ACTION_OPTIONS.map((option) => ({ ...option })),
  };
}
