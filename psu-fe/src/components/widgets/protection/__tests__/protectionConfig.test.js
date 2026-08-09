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
  DEFAULT_PROTECTION_CONTROL_CONFIG,
  loadProtectionControlConfig,
  normalizeProtectionControlConfig,
  saveProtectionControlConfig,
} from "../protectionConfig.js";

describe("protection config", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("stores configs by widget id", () => {
    saveProtectionControlConfig("protection-main", {
      deviceName: "PSU1",
      cardName: "OVP CH1",
      valueColor: "#dc2626",
      unit: "V",
      channel: "CH1",
      protectionKey: "OVP",
      frequencyHz: 2,
      valueQuery: "OVP? CH1",
      valueSetTemplate: "OVP CH1,{value}",
      tripQuery: "OVP:PROTect:STATe? CH1",
      minValue: 0,
      maxValue: 30,
      decimals: 4,
    });

    expect(loadProtectionControlConfig("protection-main")).toEqual({
      type: "protectionControl",
      deviceName: "PSU1",
      cardName: "OVP CH1",
      valueColor: "#dc2626",
      unit: "V",
      channel: "CH1",
      protectionKey: "OVP",
      frequencyHz: 2,
      valueQuery: "OVP? CH1",
      valueSetTemplate: "OVP CH1,{value}",
      tripQuery: "OVP:PROTect:STATe? CH1",
      enableQuery: "",
      enableOnCommand: "",
      enableOffCommand: "",
      enabledResponse: "1",
      disabledResponse: "0",
      minValue: 0,
      maxValue: 30,
      decimals: 4,
    });
  });

  it("falls back for malformed records", () => {
    expect(
      normalizeProtectionControlConfig({
        type: "protectionControl",
        deviceName: "PSU1",
        cardName: "OCP CH1",
        unit: "A",
        channel: "CH1",
        protectionKey: "OCP",
        frequencyHz: 500,
        valueQuery: "OCP CH1,1",
        valueSetTemplate: "/connect {value}",
        tripQuery: "OCP:PROTect:STATe CH1",
        enableQuery: "OCP:STATe? CH1",
        enableOnCommand: "/disconnect",
        enableOffCommand: "OCP:STATe CH1,0",
        enabledResponse: "1",
        disabledResponse: "1",
        minValue: "oops",
        maxValue: 10,
        decimals: 12,
      }),
    ).toEqual({
      ...DEFAULT_PROTECTION_CONTROL_CONFIG,
      deviceName: "PSU1",
      cardName: "OCP CH1",
      unit: "A",
      channel: "CH1",
      protectionKey: "OCP",
      frequencyHz: 100,
      enableQuery: "OCP:STATe? CH1",
      enableOffCommand: "OCP:STATe CH1,0",
      maxValue: 10,
      decimals: 6,
    });
  });
});
