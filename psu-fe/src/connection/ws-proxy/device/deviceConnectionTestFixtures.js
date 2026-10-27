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
import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { useDeviceConnection } from "./useDeviceConnection.js";

/** Creates a hook with deterministic request UUIDs for lifecycle tests. */
export function renderDeviceConnection(overrides = {}) {
  let nextRequestId = 0;
  const options = {
    sendWsMessage: vi.fn(() => `uuid-${(nextRequestId += 1)}`),
    appendWsMessage: vi.fn(),
    ...overrides,
  };

  return {
    options,
    ...renderHook(() => useDeviceConnection(options)),
  };
}

/** TCP and USB registry used by lifecycle scenarios. */
export const DEVICE_LIST = [
  "0,PSU1,TCP,192.168.4.1,5025,",
  "1,USB1,USB,,COM3,115200",
].join("\n");

