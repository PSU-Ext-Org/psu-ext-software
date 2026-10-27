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
import { useEffect, useRef, useState } from "react";
import { DEVICE_CONNECT_TIMEOUT_MS } from "./deviceRecoveryPolicy.js";

/**
 * Owns connect/disconnect UUIDs and independent connect timeouts.
 * Completion removes pending UUIDs so late responses cannot revive a cancelled attempt.
 */
export function useDeviceCommands({
  getDevice, getStatus, patchStatus, sendWsMessage, allowConnect, suppress, onConnected,
}) {
  const pendingIds = useRef(new Set());
  const connectRequests = useRef(new Map());
  const disconnectRequests = useRef(new Map());
  const timers = useRef(new Map());
  const [connectingIds, setConnectingIds] = useState([]);

  useEffect(() => clearPending, []);

  function connect(id) {
    const key = String(id);
    const device = getDevice(key);
    if (!device || pendingIds.current.has(key) || getStatus(key)?.state === "CONNECTED") {
      return;
    }
    pendingIds.current.add(key);
    patchStatus(key, { state: "CONNECTING", error: "" });
    setConnectingIds([...pendingIds.current]);
    timers.current.set(key, window.setTimeout(() => {
      finish(key, false, `Device connect timed out after 10 seconds: ${key}`);
    }, DEVICE_CONNECT_TIMEOUT_MS));
    allowConnect(key);
    const uuid = sendWsMessage(`/connect ${device.name}`);
    if (!uuid) {
      finish(key, false, "Cannot send connect command");
      return;
    }
    connectRequests.current.set(uuid, key);
  }

  function disconnect(id) {
    const key = String(id);
    const device = getDevice(key);
    if (!device) {
      return;
    }
    const wasConnected = getStatus(key)?.state === "CONNECTED";
    suppress(key);
    finish(key, false);
    patchStatus(key, { state: "DISCONNECTING", error: "" });
    const uuid = sendWsMessage(`/disconnect ${device.name}`);
    if (!uuid) {
      patchStatus(key, {
        state: wasConnected ? "CONNECTED" : "DISCONNECTED",
        error: "Cannot send disconnect command",
      });
      return;
    }
    disconnectRequests.current.set(uuid, key);
  }

  function finish(id, connected, error = "") {
    const key = String(id);
    window.clearTimeout(timers.current.get(key));
    timers.current.delete(key);
    for (const [uuid, pendingId] of connectRequests.current) {
      if (pendingId === key) {
        connectRequests.current.delete(uuid);
      }
    }
    pendingIds.current.delete(key);
    setConnectingIds([...pendingIds.current]);
    if (error) {
      patchStatus(key, { state: connected ? "CONNECTED" : "DISCONNECTED", error });
    }
  }

  function handleMessage(message, uuid) {
    if (message.startsWith("OK CONNECTED")) {
      const id = takeRequest(connectRequests.current, uuid);
      if (id) {
        finish(id, true);
        patchStatus(id, { state: "CONNECTED", error: "" });
        onConnected(id);
      }
      return true;
    }
    if (message.startsWith("OK DISCONNECTED")) {
      const id = takeRequest(disconnectRequests.current, uuid)
        || takeRequest(connectRequests.current, uuid);
      if (id) {
        finish(id, false);
        patchStatus(id, { state: "DISCONNECTED", error: "", identity: null });
      }
      return true;
    }
    if (message.startsWith("ERR ")) {
      const id = takeRequest(connectRequests.current, uuid)
        || takeRequest(disconnectRequests.current, uuid);
      if (id) {
        finish(id, false, message);
        return true;
      }
    }
    return false;
  }

  function isConnecting(id) {
    return pendingIds.current.has(String(id));
  }

  function clearTimeouts() {
    for (const timer of timers.current.values()) {
      window.clearTimeout(timer);
    }
    timers.current.clear();
  }

  function clearPending() {
    clearTimeouts();
    pendingIds.current.clear();
    connectRequests.current.clear();
    disconnectRequests.current.clear();
  }

  function reset() {
    clearPending();
    setConnectingIds([]);
  }

  return { connect, disconnect, finish, handleMessage, isConnecting, connectingIds, clearTimeouts, reset };
}

function takeRequest(requests, uuid) {
  if (!uuid) {
    return "";
  }
  const id = requests.get(uuid) || "";
  requests.delete(uuid);
  return id;
}
