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
import {
  cleanDeviceIdentityText,
  DEVICE_IDENTITY_MAX_CHARS,
  EMPTY_DEVICE_IDENTITY,
  isConnectionLifecycleMessage,
  parseDeviceIdentity,
} from "./deviceIdentity.js";

describe("deviceIdentity", () => {
  it("parses valid IDN responses", () => {
    expect(parseDeviceIdentity("Acme,PSU-EXT,SN001,1.2.3")).toEqual({
      manufacturer: "Acme",
      model: "PSU-EXT",
      serialNumber: "SN001",
      firmwareLevel: "1.2.3",
      name: "Acme PSU-EXT",
      raw: "Acme,PSU-EXT,SN001,1.2.3",
      valid: true,
      error: null,
    });
  });

  it("keeps extra commas in firmware level", () => {
    expect(parseDeviceIdentity("Acme,PSU,SN001,FW,with,commas")).toMatchObject({
      firmwareLevel: "FW,with,commas",
      valid: true,
    });
  });

  it("marks malformed responses without throwing away raw data", () => {
    expect(parseDeviceIdentity("wild junk")).toMatchObject({
      ...EMPTY_DEVICE_IDENTITY,
      manufacturer: "wild junk",
      raw: "wild junk",
      valid: false,
      error: "Malformed device identity response",
    });
  });

  it("sanitizes control characters and caps length", () => {
    const dirty = `Acme\u0000\n${"x".repeat(DEVICE_IDENTITY_MAX_CHARS + 20)}`;

    expect(cleanDeviceIdentityText(dirty)).toHaveLength(DEVICE_IDENTITY_MAX_CHARS);
    expect(cleanDeviceIdentityText("hello\u0000\tworld")).toBe("hello world");
  });

  it("recognises connection lifecycle messages", () => {
    expect(isConnectionLifecycleMessage("STATUS state=CONNECTED")).toBe(true);
    expect(isConnectionLifecycleMessage("OK CONNECTED")).toBe(true);
    expect(isConnectionLifecycleMessage("ERR DISCONNECTED")).toBe(true);
    expect(isConnectionLifecycleMessage("Acme,PSU,SN,FW")).toBe(false);
  });
});
