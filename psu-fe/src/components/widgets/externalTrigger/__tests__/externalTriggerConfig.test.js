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
  DEFAULT_TRIGGER_ACTION_OPTIONS,
  loadExternalTriggerControlConfig,
  normalizeExternalTriggerControlConfig,
  saveExternalTriggerControlConfig,
} from "../triggerConfig.js";
import { applyDefaultTriggerConfig } from "../utils/triggerHelpers.js";

describe("external trigger config", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("stores configs by widget id", () => {
    saveExternalTriggerControlConfig("trigger-main", {
      deviceName: "PSU1",
      cardName: "Bench Triggers",
      statusQueryTemplate: "TRIG:CONF? {trigger},{state}",
      setupCommandTemplate: "TRIG:CONF {trigger},{state},{command}",
      actionOptions: [
        { id: "toggle", name: "Toggle", scpiCommand: "OUT_TOGGLE,CH1" },
      ],
    });

    expect(loadExternalTriggerControlConfig("trigger-main")).toEqual({
      type: "externalTriggerControl",
      deviceName: "PSU1",
      cardName: "Bench Triggers",
      statusQueryTemplate: "TRIG:CONF? {trigger},{state}",
      setupCommandTemplate: "TRIG:CONF {trigger},{state},{command}",
      clearTriggerValue: "NONE",
      actionOptions: [
        { id: "toggle", name: "Toggle", scpiCommand: "OUT_TOGGLE,CH1" },
      ],
    });
  });

  it("drops malformed templates and invalid action options", () => {
    expect(
      normalizeExternalTriggerControlConfig({
        type: "externalTriggerControl",
        deviceName: "PSU1",
        cardName: "Bench",
        statusQueryTemplate: "TRIG:CONF {trigger},{state}",
        setupCommandTemplate: "/connect {trigger},{state},{command}",
        clearTriggerValue: "/disconnect",
        actionOptions: [
          { id: "valid", name: "Output On", scpiCommand: "OUT_ON,CH1" },
          { id: "bad", name: "", scpiCommand: "OUT_OFF,CH1" },
          { id: "bad2", name: "Blocked", scpiCommand: "/disconnect" },
        ],
      }),
    ).toEqual({
      type: "externalTriggerControl",
      deviceName: "PSU1",
      cardName: "Bench",
      statusQueryTemplate: "",
      setupCommandTemplate: "",
      clearTriggerValue: "NONE",
      actionOptions: [
        { id: "valid", name: "Output On", scpiCommand: "OUT_ON,CH1" },
      ],
    });
  });

  it("loads the default trigger preset", () => {
    const draft = applyDefaultTriggerConfig({
      deviceName: "PSU1",
      cardName: "",
      statusQueryTemplate: "",
      setupCommandTemplate: "",
      clearTriggerValue: "",
      actionOptions: [],
    });

    expect(draft.cardName).toBe("External Triggers");
    expect(draft.statusQueryTemplate).toBe("TRIG:CONF? {trigger},{state}");
    expect(draft.setupCommandTemplate).toBe("TRIG:CONF {trigger},{state},{command}");
    expect(draft.clearTriggerValue).toBe("NONE");
    expect(draft.actionOptions).toEqual(DEFAULT_TRIGGER_ACTION_OPTIONS);
  });
});
