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
import {
  DEFAULT_SINGLE_TOGGLE_CONFIG,
  loadSingleToggleConfig,
  loadRunnableSingleToggleSubscriptions,
  normalizeSingleToggleConfig,
  saveSingleToggleConfig,
} from "../singleToggleConfig.js";

describe("SingleToggleCard config", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("stores configs by widget id", () => {
    saveSingleToggleConfig("single-toggle-main", {
      deviceName: "PSU1",
      statusCommand: "OUTP? CH1",
      onCommand: "OUTP CH1,1",
      offCommand: "OUTP CH1,0",
      onResponse: "ON",
      offResponse: "OFF",
      cardName: "Output",
      statusColor: "#dc2626",
    });

    expect(loadSingleToggleConfig("single-toggle-main")).toEqual({
      type: "singleToggle",
      deviceName: "PSU1",
      statusCommand: "OUTP? CH1",
      onCommand: "OUTP CH1,1",
      offCommand: "OUTP CH1,0",
      onResponse: "ON",
      offResponse: "OFF",
      cardName: "Output",
      statusColor: "#dc2626",
      autoRefreshEnabled: false,
      refreshFrequencyHz: 1,
    });
  });

  it("falls back for malformed records", () => {
    expect(
      normalizeSingleToggleConfig({
        type: "singleToggle",
        deviceName: "PSU1",
        statusCommand: "OUTP CH1,1",
        onCommand: "/connect PSU1",
        offCommand: "OUTP CH1,0",
        onResponse: "1",
        offResponse: "1",
      cardName: "Output",
      statusColor: "red",
      autoRefreshEnabled: "yes",
      refreshFrequencyHz: 500,
    }),
    ).toEqual({
      ...DEFAULT_SINGLE_TOGGLE_CONFIG,
      deviceName: "PSU1",
      statusCommand: "",
      onCommand: "",
      offCommand: "OUTP CH1,0",
      cardName: "Output",
      autoRefreshEnabled: true,
      refreshFrequencyHz: 100,
    });
  });

  it("loads runnable refresh subscriptions only when enabled", () => {
    saveSingleToggleConfig("single-toggle-main", {
      deviceName: "PSU1",
      statusCommand: "OUTP? CH1",
      onCommand: "OUTP CH1,1",
      offCommand: "OUTP CH1,0",
      autoRefreshEnabled: true,
      refreshFrequencyHz: 5,
    });
    saveSingleToggleConfig("single-toggle-off", {
      deviceName: "PSU1",
      statusCommand: "OUTP? CH2",
      onCommand: "OUTP CH2,1",
      offCommand: "OUTP CH2,0",
      autoRefreshEnabled: false,
      refreshFrequencyHz: 10,
    });

    expect(loadRunnableSingleToggleSubscriptions()).toEqual([
      {
        widgetId: "single-toggle-main",
        deviceName: "PSU1",
        query: "OUTP? CH1",
        frequencyHz: 5,
      },
    ]);
  });
});
