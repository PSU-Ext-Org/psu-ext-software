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
import { afterEach, describe, expect, it } from "vitest";
import { WIDGET_CONFIG_STORAGE_KEY } from "../../widgetConfigStore.js";
import {
  loadTimerQueueControlConfig,
  parseDurationSecondsToMs,
  saveTimerQueueControlConfig,
  validateTimerQueueControlConfig,
} from "../timerQueueConfig.js";

describe("timerQueueConfig", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("validates ids, durations, uniqueness, and queue length", () => {
    expect(validateTimerQueueControlConfig({
      deviceName: "PSU1",
      timers: [],
    })).toBe("Add at least one timer.");

    expect(validateTimerQueueControlConfig({
      deviceName: "PSU1",
      timers: [{ id: "AB", durationSeconds: "1", relayOnAfterExpiry: false }],
    })).toBe("Timer ids must be exactly 3 characters.");

    expect(validateTimerQueueControlConfig({
      deviceName: "PSU1",
      timers: [{ id: "ABC", durationSeconds: "0", relayOnAfterExpiry: false }],
    })).toBe("Timer durations must be positive seconds with up to 3 decimals.");

    expect(validateTimerQueueControlConfig({
      deviceName: "PSU1",
      timers: [
        { id: "ABC", durationSeconds: "1", relayOnAfterExpiry: false },
        { id: "ABC", durationSeconds: "2", relayOnAfterExpiry: true },
      ],
    })).toBe("Timer ids must be unique within the widget.");

    expect(validateTimerQueueControlConfig({
      deviceName: "PSU1",
      timers: Array.from({ length: 11 }, (_, index) => ({
        id: `A${String(index).padStart(2, "0")}`.slice(0, 3),
        durationSeconds: "1",
        relayOnAfterExpiry: false,
      })),
    })).toBe("Timer queue supports at most 10 steps.");
  });

  it("parses duration strings with millisecond precision", () => {
    expect(parseDurationSecondsToMs("0.250")).toBe(250);
    expect(parseDurationSecondsToMs("5")).toBe(5000);
    expect(parseDurationSecondsToMs("1.234")).toBe(1234);
    expect(parseDurationSecondsToMs("1.2345")).toBeNull();
  });

  it("stores independent widget configs by widget id", () => {
    saveTimerQueueControlConfig("timer-a", {
      deviceName: "PSU1",
      cardName: "Main timers",
      timers: [{ id: "A01", durationSeconds: "5.000", relayOnAfterExpiry: true }],
    });
    saveTimerQueueControlConfig("timer-b", {
      deviceName: "PSU2",
      cardName: "Backup timers",
      timers: [{ id: "B01", durationSeconds: "2.500", relayOnAfterExpiry: false }],
    });

    const stored = JSON.parse(window.localStorage.getItem(WIDGET_CONFIG_STORAGE_KEY));
    expect(stored["timer-a"]).toMatchObject({
      type: "timerQueueControl",
      deviceName: "PSU1",
      cardName: "Main timers",
    });
    expect(stored["timer-b"]).toMatchObject({
      type: "timerQueueControl",
      deviceName: "PSU2",
      cardName: "Backup timers",
    });

    expect(loadTimerQueueControlConfig("timer-a").timers[0]).toMatchObject({
      id: "A01",
      durationSeconds: "5.000",
      relayOnAfterExpiry: true,
    });
  });
});
