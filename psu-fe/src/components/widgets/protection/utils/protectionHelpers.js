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
} from "../../../../connection/ws-proxy/scpi/scpiQueryValidation.js";
import { DEFAULT_PROTECTION_CONTROL_CONFIG } from "../protectionConfig.js";

export const INITIAL_RUNTIME_STATE = Object.freeze({
  thresholdValue: "",
  enabledState: "unsupported",
  tripped: "unknown",
  loading: false,
  error: "",
  pollError: "",
  lastUpdatedAt: 0,
});

export function validateDraftConfig(draft) {
  const errors = [];
  const valueQuery = normalizeScpiQuery(draft.valueQuery);
  const tripQuery = normalizeScpiQuery(draft.tripQuery);
  const valueSetTemplate = normalizeScpiCommand(draft.valueSetTemplate);
  const enableQuery = normalizeScpiQuery(draft.enableQuery);
  const enableOnCommand = normalizeScpiCommand(draft.enableOnCommand);
  const enableOffCommand = normalizeScpiCommand(draft.enableOffCommand);
  const hasEnableConfig = Boolean(enableQuery || enableOnCommand || enableOffCommand);
  const minValue = Number.parseFloat(draft.minValue);
  const maxValue = Number.parseFloat(draft.maxValue);
  const decimals = Number.parseInt(draft.decimals, 10);

  if (!String(draft.deviceName || "").trim()) {
    errors.push("Select a target device.");
  }

  if (!String(draft.protectionKey || "").trim()) {
    errors.push("Enter a protection key, such as OVP or OCP.");
  }

  if (!String(draft.channel || "").trim()) {
    errors.push("Enter a channel, such as CH1.");
  }

  const valueQueryError = validateScpiQuery(valueQuery);
  if (valueQueryError) {
    errors.push(valueQueryError);
  }

  if (!valueSetTemplate.includes("{value}")) {
    errors.push("Value set template must include {value}.");
  } else {
    const valueSetError = validateScpiCommand(valueSetTemplate.replace("{value}", "1"));
    if (valueSetError) {
      errors.push(valueSetError);
    }
  }

  const tripQueryError = validateScpiQuery(tripQuery);
  if (tripQueryError) {
    errors.push(tripQueryError);
  }

  if (hasEnableConfig) {
    if (!enableQuery || !enableOnCommand || !enableOffCommand) {
      errors.push("Enable support requires query, on command, and off command.");
    } else {
      const enableQueryError = validateScpiQuery(enableQuery);
      const enableOnError = validateScpiCommand(enableOnCommand);
      const enableOffError = validateScpiCommand(enableOffCommand);
      if (enableQueryError) {
        errors.push(enableQueryError);
      }
      if (enableOnError) {
        errors.push(enableOnError);
      }
      if (enableOffError) {
        errors.push(enableOffError);
      }
    }

    if (!String(draft.enabledResponse || "").trim() || !String(draft.disabledResponse || "").trim()) {
      errors.push("Enable support requires enabled and disabled response mappings.");
    }
  }

  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
    errors.push("Enter numeric min and max values.");
  } else if (minValue > maxValue) {
    errors.push("Min value must be less than or equal to max value.");
  }

  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 6) {
    errors.push("Decimals must be an integer between 0 and 6.");
  }

  return errors;
}

export function validateRunnableConfig(config) {
  if (!config.deviceName || !config.valueQuery || !config.valueSetTemplate || !config.tripQuery) {
    return "Configure this protection widget.";
  }

  if (!config.protectionKey || !config.channel) {
    return "Complete the protection identity.";
  }

  if (validateScpiQuery(config.valueQuery)) {
    return validateScpiQuery(config.valueQuery);
  }

  if (!config.valueSetTemplate.includes("{value}")) {
    return "Value set template must include {value}.";
  }

  if (validateScpiCommand(config.valueSetTemplate.replace("{value}", "1"))) {
    return validateScpiCommand(config.valueSetTemplate.replace("{value}", "1"));
  }

  if (validateScpiQuery(config.tripQuery)) {
    return validateScpiQuery(config.tripQuery);
  }

  if (hasEnableSupport(config)) {
    return (
      validateScpiQuery(config.enableQuery) ||
      validateScpiCommand(config.enableOnCommand) ||
      validateScpiCommand(config.enableOffCommand)
    );
  }

  return "";
}

export function validateDraftThreshold(value, config, loading) {
  if (loading) {
    return "";
  }

  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }

  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) {
    return "Enter a valid number.";
  }

  if (parsed < config.minValue || parsed > config.maxValue) {
    return `Value must be between ${config.minValue} and ${config.maxValue}.`;
  }

  if (!matchesDecimals(trimmed, config.decimals)) {
    return `Value must use at most ${config.decimals} decimal places.`;
  }

  return "";
}

export function parseTripState(response) {
  const normalized = String(response ?? "").trim().toUpperCase();
  if (normalized === "1" || normalized === "ON" || normalized === "TRUE") {
    return true;
  }

  if (normalized === "0" || normalized === "OFF" || normalized === "FALSE") {
    return false;
  }

  return "unknown";
}

export function parseEnabledState(response, config) {
  const normalized = String(response ?? "").trim();
  if (normalized === String(config.enabledResponse).trim()) {
    return "enabled";
  }

  if (normalized === String(config.disabledResponse).trim()) {
    return "disabled";
  }

  return "unknown";
}

export function hasEnableSupport(config) {
  return Boolean(config.enableQuery && config.enableOnCommand && config.enableOffCommand);
}

export function getProtectionCardName(config) {
  return (
    String(config.cardName || "").trim() ||
    [config.protectionKey, config.channel].filter(Boolean).join(" ") ||
    DEFAULT_PROTECTION_CONTROL_CONFIG.cardName
  );
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

  return runtime.error || runtime.pollError || "Ready";
}

export function getTripText(tripped) {
  if (tripped === true) {
    return "Tripped";
  }

  if (tripped === false) {
    return "Clear";
  }

  return "Unknown";
}

export function getEnableText(enabledState) {
  if (enabledState === "enabled") {
    return "Enabled";
  }

  if (enabledState === "disabled") {
    return "Disabled";
  }

  if (enabledState === "unsupported") {
    return "Always on";
  }

  return "Unknown";
}

export function formatConfiguredValue(value, decimals) {
  return Number.parseFloat(value).toFixed(decimals);
}

export function formatDisplayThreshold(value, decimals) {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed.toFixed(decimals) : "--";
}

export function getNumericStep(decimals) {
  return decimals > 0 ? (1 / (10 ** decimals)).toFixed(decimals) : "1";
}

export function applyProtectionPreset(draft, protectionKey) {
  const channel = String(draft.channel || "CH1").trim() || "CH1";
  const nextKey = protectionKey.toUpperCase();
  const base = {
    ...draft,
    protectionKey: nextKey,
    channel,
    cardName: `${nextKey} ${channel}`,
    valueQuery: `${nextKey}? ${channel}`,
    valueSetTemplate: `${nextKey} ${channel},{value}`,
    tripQuery: `${nextKey}:PROTect:STATe? ${channel}`,
  };

  if (nextKey === "OCP") {
    return {
      ...base,
      unit: draft.unit || "A",
      enableQuery: `OCP:STATe? ${channel}`,
      enableOnCommand: `OCP:STATe ${channel},1`,
      enableOffCommand: `OCP:STATe ${channel},0`,
      minValue: draft.minValue || 0,
      maxValue: draft.maxValue || 10,
      decimals: draft.decimals || 4,
    };
  }

  return {
    ...base,
    unit: draft.unit || "V",
    enableQuery: "",
    enableOnCommand: "",
    enableOffCommand: "",
    minValue: draft.minValue || 0,
    maxValue: draft.maxValue || 30,
    decimals: draft.decimals || 4,
  };
}

function matchesDecimals(value, decimals) {
  const [, fraction = ""] = String(value).trim().split(".");
  return fraction.length <= decimals;
}
