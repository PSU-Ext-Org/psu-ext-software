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
import { loadStoredWidgetConfig, saveStoredWidgetConfig, useStoredWidgetConfig } from "../widgetConfigStore.js";

/** Fixed device channel supported by the timer queue widget. */
export const TIMER_QUEUE_CHANNEL = "CH1";

/** Shared timer queue limits used by editing and persistence. */
export const TIMER_QUEUE_LIMITS = Object.freeze({
  cardNameMaxLength: 48,
  maxTimers: 10,
  timerIdLength: 3,
});

/** User-facing validation messages for timer queue configuration. */
export const TIMER_QUEUE_VALIDATION_MESSAGE = Object.freeze({
  DEVICE_REQUIRED: "Select a target device.",
  DURATION_INVALID: "Timer durations must be positive seconds with up to 3 decimals.",
  ID_INVALID: "Timer ids must be exactly 3 characters.",
  ID_NOT_UNIQUE: "Timer ids must be unique within the widget.",
  TIMER_LIMIT_EXCEEDED: `Timer queue supports at most ${TIMER_QUEUE_LIMITS.maxTimers} steps.`,
  TIMER_REQUIRED: "Add at least one timer.",
});

export const DEFAULT_TIMER_QUEUE_CONTROL_CONFIG = Object.freeze({
  type: "timerQueueControl",
  deviceName: "",
  channel: TIMER_QUEUE_CHANNEL,
  cardName: "Timer Queue",
  timers: [],
});

const DURATION_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/;

/**
 * Loads and normalizes the persisted configuration for one timer queue widget.
 *
 * @param {string} widgetId - Dashboard widget identifier.
 * @returns {object} Normalized timer queue configuration.
 */
export function loadTimerQueueControlConfig(widgetId) {
  return normalizeTimerQueueControlConfig(loadStoredWidgetConfig(widgetId));
}

/**
 * Normalizes and persists the configuration for one timer queue widget.
 *
 * @param {string} widgetId - Dashboard widget identifier.
 * @param {object} config - Candidate timer queue configuration.
 * @returns {object} Persisted normalized configuration.
 */
export function saveTimerQueueControlConfig(widgetId, config) {
  const normalized = normalizeTimerQueueControlConfig({ ...config, type: "timerQueueControl" });
  return saveStoredWidgetConfig(widgetId, normalized);
}

/**
 * Subscribes a component to normalized configuration changes for one widget.
 *
 * @param {string} widgetId - Dashboard widget identifier.
 * @returns {[object, (config: object) => void]} Current configuration and local state setter.
 */
export function useTimerQueueControlConfig(widgetId) {
  return useStoredWidgetConfig(widgetId, loadTimerQueueControlConfig);
}

/**
 * Converts untrusted persisted data into a complete timer queue configuration.
 *
 * @param {unknown} candidate - Untrusted stored value.
 * @returns {object} Complete normalized configuration.
 */
export function normalizeTimerQueueControlConfig(candidate) {
  if (!candidate || typeof candidate !== "object" || candidate.type !== "timerQueueControl") {
    return cloneDefaultTimerQueueControlConfig();
  }

  return {
    type: "timerQueueControl",
    deviceName: String(candidate.deviceName || "").trim(),
    channel: TIMER_QUEUE_CHANNEL,
    cardName: String(candidate.cardName || DEFAULT_TIMER_QUEUE_CONTROL_CONFIG.cardName).trim().slice(0, TIMER_QUEUE_LIMITS.cardNameMaxLength)
      || DEFAULT_TIMER_QUEUE_CONTROL_CONFIG.cardName,
    timers: normalizeTimerRows(candidate.timers),
  };
}

/**
 * Normalizes persisted timer rows while enforcing the configured timer limit.
 *
 * @param {unknown} candidate - Candidate timer-row collection.
 * @returns {Array<object>} Normalized timer rows.
 */
export function normalizeTimerRows(candidate) {
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate.slice(0, TIMER_QUEUE_LIMITS.maxTimers).map((row) => ({
    id: String(row?.id || "").trim().slice(0, TIMER_QUEUE_LIMITS.timerIdLength),
    durationSeconds: normalizeDurationSeconds(row?.durationSeconds),
    relayOnAfterExpiry: Boolean(row?.relayOnAfterExpiry),
  }));
}

/**
 * Converts an editable duration field to its normalized string representation.
 *
 * @param {unknown} value - Editable field value.
 * @returns {string} Trimmed duration text.
 */
export function normalizeDurationSeconds(value) {
  return String(value || "").trim().slice(0, 16);
}

/**
 * Parses a positive duration string with millisecond precision.
 *
 * @param {unknown} value - Duration in seconds.
 * @returns {number | null} Milliseconds, or null when invalid.
 */
export function parseDurationSecondsToMs(value) {
  const normalized = normalizeDurationSeconds(value);
  if (!DURATION_PATTERN.test(normalized)) {
    return null;
  }

  const seconds = Number.parseFloat(normalized);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  const milliseconds = Math.round(seconds * 1000);
  return milliseconds > 0 ? milliseconds : null;
}

/**
 * Returns the first field-level validation issue for a timer row, if any.
 *
 * @param {object} row - Candidate timer row.
 * @returns {{field: string, message: string} | null} Field issue.
 */
export function getTimerRowValidationIssue(row) {
  const id = String(row?.id || "").trim();
  if (id.length !== TIMER_QUEUE_LIMITS.timerIdLength) {
    return { field: "id", message: TIMER_QUEUE_VALIDATION_MESSAGE.ID_INVALID };
  }

  if (parseDurationSecondsToMs(row?.durationSeconds) == null) {
    return { field: "durationSeconds", message: TIMER_QUEUE_VALIDATION_MESSAGE.DURATION_INVALID };
  }

  return null;
}

/**
 * Returns a row validation message for callers that only need text.
 *
 * @param {object} row - Candidate timer row.
 * @returns {string} Validation message, or an empty string.
 */
export function validateTimerRow(row) {
  return getTimerRowValidationIssue(row)?.message || "";
}

/**
 * Returns the first widget-level or row-level configuration validation issue.
 *
 * @param {object} config - Candidate timer queue configuration.
 * @returns {{message: string, rowIndex?: number, field?: string} | null} Validation issue.
 */
export function getTimerQueueValidationIssue(config) {
  if (!String(config?.deviceName || "").trim()) {
    return { message: TIMER_QUEUE_VALIDATION_MESSAGE.DEVICE_REQUIRED };
  }

  if (!Array.isArray(config?.timers) || config.timers.length < 1) {
    return { message: TIMER_QUEUE_VALIDATION_MESSAGE.TIMER_REQUIRED };
  }

  if (config.timers.length > TIMER_QUEUE_LIMITS.maxTimers) {
    return { message: TIMER_QUEUE_VALIDATION_MESSAGE.TIMER_LIMIT_EXCEEDED };
  }

  const seenIds = new Set();
  for (const [index, row] of config.timers.entries()) {
    const rowValidation = getTimerRowValidationIssue(row);
    if (rowValidation) {
      return { ...rowValidation, rowIndex: index };
    }

    const id = String(row?.id || "").trim();
    if (seenIds.has(id)) {
      return {
        message: TIMER_QUEUE_VALIDATION_MESSAGE.ID_NOT_UNIQUE,
        rowIndex: index,
        field: "id",
      };
    }

    seenIds.add(id);
  }

  return null;
}

/**
 * Returns the first configuration validation message, or an empty string when valid.
 *
 * @param {object} config - Candidate timer queue configuration.
 * @returns {string} Validation message, or an empty string.
 */
export function validateTimerQueueControlConfig(config) {
  return getTimerQueueValidationIssue(config)?.message || "";
}

/**
 * Creates a mutable default configuration suitable for component state.
 *
 * @returns {object} Fresh default configuration.
 */
export function cloneDefaultTimerQueueControlConfig() {
  return {
    ...DEFAULT_TIMER_QUEUE_CONTROL_CONFIG,
    timers: [],
  };
}

/**
 * Creates an empty editable timer row.
 *
 * @returns {{id: string, durationSeconds: string, relayOnAfterExpiry: boolean}} Empty row.
 */
export function createEmptyTimerRow() {
  return {
    id: "",
    durationSeconds: "",
    relayOnAfterExpiry: false,
  };
}

/**
 * Returns shared limits for legacy callers. Prefer `TIMER_QUEUE_LIMITS` in new code.
 *
 * @returns {{cardNameMaxLength: number, maxTimers: number, timerIdLength: number}} Immutable limits.
 */
export function getTimerQueueConfigLimits() {
  return TIMER_QUEUE_LIMITS;
}
