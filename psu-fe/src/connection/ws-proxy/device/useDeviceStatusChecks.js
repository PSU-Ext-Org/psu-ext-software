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
import { useEffect, useRef } from "react";
import { DEVICE_CONNECT_TIMEOUT_MS, isDeviceDisconnectError } from "./deviceRecoveryPolicy.js";

/** Coalesces error-triggered status requests; confirmed losses update the device immediately. */
export function useDeviceStatusChecks({
  wsConnected, findByName, getStatus, patchStatus, sendWsMessage, appendWsMessage,
}) {
  const pending = useRef(null);

  useEffect(() => reset, []);

  function checkDeviceStatusAfterError(deviceName, error = "") {
    if (!wsConnected) {
      return false;
    }
    const device = findByName(deviceName);
    if (device && isDeviceDisconnectError(error)) {
      if (getStatus(device.id)?.state === "CONNECTED") {
        patchStatus(device.id, { state: "DISCONNECTED", error });
        appendWsMessage("system", `Device ${device.name} disconnected: ${error}`);
      }
      return true;
    }
    if (!pending.current || Date.now() - pending.current.sentAt >= DEVICE_CONNECT_TIMEOUT_MS) {
      const uuid = sendWsMessage("/status");
      pending.current = uuid ? { uuid, sentAt: Date.now() } : null;
    }
    return false;
  }

  function acknowledge(uuid) {
    if (pending.current?.uuid === uuid) {
      pending.current = null;
    }
  }

  function reset() {
    pending.current = null;
  }

  return { checkDeviceStatusAfterError, acknowledge, reset };
}
