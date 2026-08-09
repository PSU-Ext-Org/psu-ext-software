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
import { normalizeScpiQuery, validateScpiQuery } from "./scpiQueryValidation.js";

describe("SCPI query validation", () => {
  it("accepts query commands with optional arguments after the query marker", () => {
    expect(validateScpiQuery("*IDN?")).toBe("");
    expect(validateScpiQuery("MEAS:VOLT?")).toBe("");
    expect(validateScpiQuery("MEAS:VOLT? CH1")).toBe("");
    expect(validateScpiQuery(":MEASure:CURRent? (@1)")).toBe("");
  });

  it("rejects non-query and connection lifecycle commands", () => {
    expect(validateScpiQuery("OUTP ON")).toMatch(/query marker/);
    expect(validateScpiQuery("MEAS:VOLT CH1")).toMatch(/query marker/);
    expect(validateScpiQuery("/connect PSU1")).toMatch(/not allowed/);
    expect(validateScpiQuery("/disconnect PSU1")).toMatch(/not allowed/);
  });

  it("rejects empty and control-character input", () => {
    expect(validateScpiQuery("")).toMatch(/Enter/);
    expect(validateScpiQuery("MEAS:VOLT?\nCH1")).toMatch(/control characters/);
  });

  it("normalizes whitespace for cache identity", () => {
    expect(normalizeScpiQuery("  MEAS:VOLT?   CH1  ")).toBe("MEAS:VOLT? CH1");
  });
});
