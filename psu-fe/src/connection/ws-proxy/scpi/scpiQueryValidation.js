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
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const QUERY_MARK_PATTERN = /\S\?/;

/**
 * Normalizes user-entered SCPI command text for identity/cache comparison.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeScpiQuery(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

/**
 * Normalizes user-entered SCPI command text.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeScpiCommand(value) {
  return normalizeScpiQuery(value);
}

/**
 * Returns a validation error for unsupported dashboard SCPI queries.
 *
 * Dashboard value widgets are query-only. Arguments after the query marker are
 * allowed, for example `MEAS:VOLT? CH1`.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function validateScpiQuery(value) {
  const normalized = normalizeScpiQuery(value);
  const lower = normalized.toLowerCase();

  if (!normalized) {
    return "Enter a SCPI query.";
  }

  if (CONTROL_CHARACTER_PATTERN.test(String(value ?? ""))) {
    return "SCPI query cannot contain control characters.";
  }

  if (lower.startsWith("/connect") || lower.startsWith("/disconnect")) {
    return "Connection management commands are not allowed.";
  }

  if (!QUERY_MARK_PATTERN.test(normalized)) {
    return "SCPI query must contain a query marker, such as MEAS:VOLT? CH1.";
  }

  return "";
}

/**
 * Returns a validation error for dashboard SCPI commands.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function validateScpiCommand(value) {
  const normalized = normalizeScpiCommand(value);
  const lower = normalized.toLowerCase();

  if (!normalized) {
    return "Enter a SCPI command.";
  }

  if (CONTROL_CHARACTER_PATTERN.test(String(value ?? ""))) {
    return "SCPI command cannot contain control characters.";
  }

  if (lower.startsWith("/connect") || lower.startsWith("/disconnect")) {
    return "Connection management commands are not allowed.";
  }

  return "";
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidScpiQuery(value) {
  return validateScpiQuery(value) === "";
}
