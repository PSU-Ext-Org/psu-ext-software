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
import { describe, expect, it } from "vitest";
import { validateDraft } from "../utils/singleValuePresentation.js";
import { DEFAULT_SINGLE_VALUE_CONFIG } from "../singleValueConfig.js";

const VALID_WRITE_DRAFT = {
  ...DEFAULT_SINGLE_VALUE_CONFIG,
  deviceName: "PSU1",
  query: "MEAS:VOLT?",
  setValueEnabled: true,
  setValueCommand: "VOLT {value}",
};

const INVALID_COMMANDS = [
  "",
  "VOLT",
  "VOLT {value} {value}",
  "VOLT {value}\n",
  "/connect {value}",
];

describe("single value write settings validation", () => {
  it.each(INVALID_COMMANDS)("rejects invalid command %j", (setValueCommand) => {
    const draft = { ...VALID_WRITE_DRAFT, setValueCommand };

    expect(validateDraft(draft)).not.toEqual([]);
  });

  it.each(["", "  ", "0", "-1e3", "OFF"])("accepts optional textual default %j", (defaultValue) => {
    const draft = { ...VALID_WRITE_DRAFT, defaultValue };

    expect(validateDraft(draft)).toEqual([]);
  });

  it("rejects control characters in the default only when enabled", () => {
    const invalidDraft = { ...VALID_WRITE_DRAFT, defaultValue: "0\n" };
    const disabledDraft = {
      ...invalidDraft,
      setValueEnabled: false,
      setValueCommand: "",
    };

    // Disabled write settings must not prevent saving a read-only card.
    expect(validateDraft(invalidDraft)).not.toEqual([]);
    expect(validateDraft(disabledDraft)).toEqual([]);
  });
});
