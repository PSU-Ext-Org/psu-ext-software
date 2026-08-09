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
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDeviceIdentity } from "./useDeviceIdentity.js";

describe("useDeviceIdentity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("queries and stores a valid identity response", () => {
    const sendWsMessage = vi.fn(() => true);
    const { result } = renderHook(() => useDeviceIdentity({ sendWsMessage }));

    act(() => {
      result.current.requestDeviceIdentity();
    });

    expect(sendWsMessage).toHaveBeenCalledWith("*IDN?");

    act(() => {
      result.current.updateDeviceIdentityFromMessage("Acme Instruments,PSU-EXT-42,SN001,1.2.3");
    });

    expect(result.current.deviceIdentity).toMatchObject({
      name: "Acme Instruments PSU-EXT-42",
      valid: true,
      error: null,
    });
  });

  it("stores malformed and error responses as invalid identity state", () => {
    const malformed = renderHook(() => useDeviceIdentity({ sendWsMessage: () => true }));

    act(() => {
      malformed.result.current.requestDeviceIdentity();
      malformed.result.current.updateDeviceIdentityFromMessage("not even close");
    });

    expect(malformed.result.current.deviceIdentity).toMatchObject({
      valid: false,
      error: "Malformed device identity response",
    });

    const failed = renderHook(() => useDeviceIdentity({ sendWsMessage: () => true }));

    act(() => {
      failed.result.current.requestDeviceIdentity();
      failed.result.current.updateDeviceIdentityFromMessage("ERR DEVICE identity unavailable");
    });

    expect(failed.result.current.deviceIdentity).toMatchObject({
      raw: "ERR DEVICE identity unavailable",
      valid: false,
      error: "Device identity query failed",
    });
  });

  it("marks identity invalid when the query times out", () => {
    const { result } = renderHook(() => useDeviceIdentity({ sendWsMessage: () => true }));

    act(() => {
      result.current.requestDeviceIdentity();
      vi.advanceTimersByTime(3_000);
    });

    expect(result.current.deviceIdentity).toMatchObject({
      valid: false,
      error: "Device identity query timed out",
    });
  });
});
