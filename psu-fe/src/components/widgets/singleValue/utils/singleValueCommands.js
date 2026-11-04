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
import { validateScpiCommand } from "../../../../connection/ws-proxy/scpi/scpiQueryValidation.js";

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const VALUE_PLACEHOLDER = "{value}";

/**
 * Validates a numeric or textual SCPI argument without changing its contents.
 *
 * @param {unknown} value - User-entered argument, including surrounding whitespace.
 * @returns {string} Validation message, or an empty string for a valid argument.
 */
export function validateSetValue(value) {
  const text = String(value ?? "");

  if (CONTROL_CHARACTER_PATTERN.test(text)) {
    return "Value cannot contain control characters.";
  }

  return text.trim() ? "" : "Enter a value.";
}

/**
 * Validates write settings independently of measurement polling.
 * Callers decide whether the optional write feature is enabled.
 *
 * @param {{setValueCommand: string, defaultValue?: string}} config
 * @returns {string} First validation message, or an empty string when valid.
 */
export function validateSetValueConfig(config) {
  const commandError = validateScpiCommand(config.setValueCommand);

  if (commandError) {
    return commandError;
  }

  const placeholderCount = String(config.setValueCommand).split(VALUE_PLACEHOLDER).length - 1;

  if (placeholderCount !== 1) {
    return "Set value SCPI command must contain exactly one {value} placeholder.";
  }

  const defaultValue = String(config.defaultValue ?? "");

  // Blank defaults hide the button, but control characters must still be rejected.
  if (!defaultValue.trim() && !CONTROL_CHARACTER_PATTERN.test(defaultValue)) {
    return "";
  }

  return validateSetValue(defaultValue);
}

/**
 * Substitutes a validated argument into a validated command template.
 *
 * @param {string} command - SCPI command containing exactly one {value} placeholder.
 * @param {string} value - Argument whose surrounding whitespace will be trimmed.
 * @returns {string} Ready-to-send SCPI command.
 */
export function buildSetValueCommand(command, value) {
  // A replacement callback preserves literal dollar sequences such as "$&".
  return command.trim().replace(VALUE_PLACEHOLDER, () => String(value).trim());
}
