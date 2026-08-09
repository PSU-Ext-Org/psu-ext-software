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
import { useRef, useState } from "react";
import {
  cleanDeviceIdentityText,
  EMPTY_DEVICE_IDENTITY,
  isConnectionLifecycleMessage,
  parseDeviceIdentity,
} from "./deviceIdentity.js";

const DEVICE_IDENTITY_TIMEOUT_MS = 3_000;

/**
 * Owns automatic device identity querying and response parsing.
 *
 * @param {object} options
 * @param {(message: string) => boolean} options.sendWsMessage - Sends a raw WebSocket message.
 * @returns {{
 *   deviceIdentity: typeof EMPTY_DEVICE_IDENTITY,
 *   requestDeviceIdentity: () => void,
 *   updateDeviceIdentityFromMessage: (message: string) => void,
 *   resetDeviceIdentity: () => void,
 *   clearDeviceIdentityTimeout: () => void
 * }}
 */
export function useDeviceIdentity({ sendWsMessage }) {
  const deviceIdentityTimeoutRef = useRef(null);
  const deviceIdentityPendingRef = useRef(false);
  const deviceIdentityRequestedRef = useRef(false);
  const [deviceIdentity, setDeviceIdentity] = useState(EMPTY_DEVICE_IDENTITY);

  function requestDeviceIdentity() {
    if (deviceIdentityPendingRef.current || deviceIdentityRequestedRef.current) {
      return;
    }

    deviceIdentityRequestedRef.current = true;
    deviceIdentityPendingRef.current = true;
    setDeviceIdentity({ ...EMPTY_DEVICE_IDENTITY, error: null });

    if (!sendWsMessage("*IDN?")) {
      deviceIdentityPendingRef.current = false;
      setDeviceIdentity({
        ...EMPTY_DEVICE_IDENTITY,
        valid: false,
        error: "Device identity query could not be sent",
      });
      return;
    }

    clearDeviceIdentityTimeout();
    deviceIdentityTimeoutRef.current = window.setTimeout(() => {
      if (!deviceIdentityPendingRef.current) {
        return;
      }

      deviceIdentityPendingRef.current = false;
      setDeviceIdentity((current) => ({
        ...current,
        valid: false,
        error: "Device identity query timed out",
      }));
    }, DEVICE_IDENTITY_TIMEOUT_MS);
  }

  function updateDeviceIdentityFromMessage(message) {
    if (!deviceIdentityPendingRef.current || isConnectionLifecycleMessage(message)) {
      return;
    }

    clearDeviceIdentityTimeout();
    deviceIdentityPendingRef.current = false;

    if (message.startsWith("ERR ")) {
      setDeviceIdentity({
        ...EMPTY_DEVICE_IDENTITY,
        raw: cleanDeviceIdentityText(message),
        valid: false,
        error: "Device identity query failed",
      });
      return;
    }

    setDeviceIdentity(parseDeviceIdentity(message));
  }

  function resetDeviceIdentity() {
    clearDeviceIdentityTimeout();
    deviceIdentityPendingRef.current = false;
    deviceIdentityRequestedRef.current = false;
    setDeviceIdentity(EMPTY_DEVICE_IDENTITY);
  }

  function clearDeviceIdentityTimeout() {
    if (deviceIdentityTimeoutRef.current) {
      window.clearTimeout(deviceIdentityTimeoutRef.current);
      deviceIdentityTimeoutRef.current = null;
    }
  }

  return {
    deviceIdentity,
    requestDeviceIdentity,
    updateDeviceIdentityFromMessage,
    resetDeviceIdentity,
    clearDeviceIdentityTimeout,
  };
}
