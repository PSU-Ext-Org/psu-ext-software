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
import { isConnectionLifecycleMessage, parseDeviceIdentity } from "../identity/deviceIdentity.js";
import { parseDeviceList } from "./deviceRegistry.js";

/** Owns per-device identity requests, deduplication and UUID correlation. */
export function useDeviceIdentities({ getDevice, getStatus, patchStatus, sendWsMessage }) {
  const requested = useRef(new Set());
  const pending = useRef(new Map());

  useEffect(() => reset, []);

  function request(id) {
    const key = String(id);
    const device = getDevice(key);
    if (!device || getStatus(key)?.state !== "CONNECTED" || requested.current.has(key)) {
      return;
    }
    requested.current.add(key);
    const uuid = sendWsMessage(`CMD ${device.name} *IDN?`);
    if (!uuid) {
      patchStatus(key, { identity: null, error: "Device identity query could not be sent" });
      requested.current.delete(key);
      return;
    }
    pending.current.set(uuid, key);
  }

  function handleMessage(message, uuid) {
    if (isConnectionLifecycleMessage(message) || parseDeviceList(message).length) {
      return;
    }
    const id = pending.current.get(uuid);
    if (!id) {
      return;
    }
    pending.current.delete(uuid);
    const patch = message.startsWith("ERR ")
      ? { identity: null, error: message }
      : { identity: parseDeviceIdentity(message), error: "" };
    patchStatus(id, patch);
  }

  function forget(id) {
    const key = String(id);
    requested.current.delete(key);
    for (const [uuid, pendingId] of pending.current) {
      if (pendingId === key) {
        pending.current.delete(uuid);
      }
    }
  }

  function reset() {
    requested.current.clear();
    pending.current.clear();
  }

  return { request, handleMessage, forget, reset };
}
