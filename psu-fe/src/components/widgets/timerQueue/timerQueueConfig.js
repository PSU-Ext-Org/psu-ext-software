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

export const DEFAULT_TIMER_QUEUE_CONTROL_CONFIG = Object.freeze({
  type: "timerQueueControl",
  deviceName: "",
  channel: "CH1",
  cardName: "Timer Queue",
  timers: [],
});

const TIMER_ID_LENGTH = 3;
const MAX_TIMERS = 10;
const CARD_NAME_MAX_LENGTH = 48;
const DURATION_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/;

export function loadTimerQueueControlConfig(widgetId) {
  return normalizeTimerQueueControlConfig(loadStoredWidgetConfig(widgetId));
}

export function saveTimerQueueControlConfig(widgetId, config) {
  const normalized = normalizeTimerQueueControlConfig({ ...config, type: "timerQueueControl" });
  return saveStoredWidgetConfig(widgetId, normalized);
}

export function useTimerQueueControlConfig(widgetId) {
  return useStoredWidgetConfig(widgetId, loadTimerQueueControlConfig);
}

export function normalizeTimerQueueControlConfig(candidate) {
  if (!candidate || typeof candidate !== "object" || candidate.type !== "timerQueueControl") {
    return cloneDefaultTimerQueueControlConfig();
  }

  return {
    type: "timerQueueControl",
    deviceName: String(candidate.deviceName || "").trim(),
    channel: "CH1",
    cardName: String(candidate.cardName || DEFAULT_TIMER_QUEUE_CONTROL_CONFIG.cardName).trim().slice(0, CARD_NAME_MAX_LENGTH)
      || DEFAULT_TIMER_QUEUE_CONTROL_CONFIG.cardName,
    timers: normalizeTimerRows(candidate.timers),
  };
}

export function normalizeTimerRows(candidate) {
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate.slice(0, MAX_TIMERS).map((row) => ({
    id: String(row?.id || "").trim().slice(0, TIMER_ID_LENGTH),
    durationSeconds: normalizeDurationSeconds(row?.durationSeconds),
    relayOnAfterExpiry: Boolean(row?.relayOnAfterExpiry),
  }));
}

export function normalizeDurationSeconds(value) {
  return String(value || "").trim().slice(0, 16);
}

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

export function validateTimerRow(row) {
  const id = String(row?.id || "").trim();
  if (id.length !== TIMER_ID_LENGTH) {
    return "Timer ids must be exactly 3 characters.";
  }

  if (parseDurationSecondsToMs(row?.durationSeconds) == null) {
    return "Timer durations must be positive seconds with up to 3 decimals.";
  }

  return "";
}

export function getTimerQueueValidationIssue(config) {
  if (!String(config?.deviceName || "").trim()) {
    return { message: "Select a target device." };
  }

  if (!Array.isArray(config?.timers) || config.timers.length < 1) {
    return { message: "Add at least one timer." };
  }

  if (config.timers.length > MAX_TIMERS) {
    return { message: `Timer queue supports at most ${MAX_TIMERS} steps.` };
  }

  const seenIds = new Set();
  for (const [index, row] of config.timers.entries()) {
    const id = String(row?.id || "").trim();
    if (id.length !== TIMER_ID_LENGTH) {
      return {
        message: "Timer ids must be exactly 3 characters.",
        rowIndex: index,
        field: "id",
      };
    }

    if (parseDurationSecondsToMs(row?.durationSeconds) == null) {
      return {
        message: "Timer durations must be positive seconds with up to 3 decimals.",
        rowIndex: index,
        field: "durationSeconds",
      };
    }

    if (seenIds.has(id)) {
      return {
        message: "Timer ids must be unique within the widget.",
        rowIndex: index,
        field: "id",
      };
    }

    seenIds.add(id);
  }

  return null;
}

export function validateTimerQueueControlConfig(config) {
  return getTimerQueueValidationIssue(config)?.message || "";
}

export function cloneDefaultTimerQueueControlConfig() {
  return {
    ...DEFAULT_TIMER_QUEUE_CONTROL_CONFIG,
    timers: [],
  };
}

export function createEmptyTimerRow() {
  return {
    id: "",
    durationSeconds: "",
    relayOnAfterExpiry: false,
  };
}

export function getTimerQueueConfigLimits() {
  return {
    maxTimers: MAX_TIMERS,
    timerIdLength: TIMER_ID_LENGTH,
  };
}
