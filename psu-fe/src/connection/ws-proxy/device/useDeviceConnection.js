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
import { isConnectionLifecycleMessage, parseDeviceIdentity } from "../identity/deviceIdentity.js";
import {
  EMPTY_DEVICE_STATUS,
  countConnectedDevices,
  parseDeviceList,
  parseStatusList,
} from "./deviceRegistry.js";

const CONNECTION_TIMEOUT_MS = 10_000;

/**
 * Owns proxy device registry and per-device connection state.
 *
 * @param {object} options
 * @param {(message: string) => string | null} options.sendWsMessage
 * @param {(direction: string, message: string) => void} options.appendWsMessage
 * @returns {{
 *   devices: {id: string, name: string, type: string, ip: string, port: string, baudrate: string}[],
 *   deviceByNameRef: import("react").MutableRefObject<Map<string, {id: string, name: string, type: string, ip: string, port: string, baudrate: string}>>,
 *   deviceStatuses: Record<string, typeof EMPTY_DEVICE_STATUS>,
 *   deviceConnected: boolean,
 *   deviceConnectedRef: import("react").MutableRefObject<boolean>,
 *   deviceConnecting: boolean,
 *   deviceConnectingIds: string[],
 *   connectDevice: (id: string) => void,
 *   connectAllDevices: () => void,
 *   connectConfiguredDevices: (ids: string[]) => void,
 *   disconnectDevice: (id: string) => void,
 *   requestDevicesAndStatuses: (options?: {autoConnectDeviceIds?: string[]}) => void,
 *   updateDeviceStateFromMessage: (message: string, uuid?: string) => void,
 *   resetDeviceState: () => void,
 *   clearDeviceConnectTimeout: () => void,
 *   updateDeviceConnected: (value: boolean) => void
 * }}
 */
export function useDeviceConnection({ sendWsMessage, appendWsMessage }) {
  const deviceConnectTimeoutRef = useRef(null);
  const pendingConnectIdsRef = useRef([]);
  const pendingConnectByUuidRef = useRef(new Map());
  const pendingDisconnectByUuidRef = useRef(new Map());
  const pendingDeviceListUuidsRef = useRef(new Set());
  const pendingIdentityByUuidRef = useRef(new Map());
  const deviceConnectedRef = useRef(false);
  const devicesRef = useRef([]);
  const deviceByIdRef = useRef(new Map());
  const deviceByNameRef = useRef(new Map());
  const deviceStatusesRef = useRef({});
  const identityRequestedIdsRef = useRef([]);
  const autoConnectDeviceIdsAfterDeviceListRef = useRef([]);
  const [devices, setDevices] = useState([]);
  const [deviceStatuses, setDeviceStatuses] = useState({});
  const [deviceConnecting, setDeviceConnecting] = useState(false);
  const [deviceConnectingIds, setDeviceConnectingIds] = useState([]);

  function requestDevicesAndStatuses({ autoConnectDeviceIds = [] } = {}) {
    autoConnectDeviceIdsAfterDeviceListRef.current = Array.isArray(autoConnectDeviceIds)
      ? autoConnectDeviceIds.map((id) => String(id))
      : [];
    const listUuid = sendWsMessage("/device-list");
    if (listUuid) {
      pendingDeviceListUuidsRef.current.add(listUuid);
    }
    sendWsMessage("/status");
  }

  function connectDevice(id) {
    const device = findDevice(id);
    if (!device || isConnecting(id) || deviceStatusesRef.current[id]?.state === "CONNECTED") {
      return;
    }

    beginConnect(id);
    const uuid = sendWsMessage(`/connect ${device.name}`);
    if (!uuid) {
      finishConnect(id, false, "Cannot send connect command");
      return;
    }
    pendingConnectByUuidRef.current.set(uuid, String(id));
  }

  function connectAllDevices() {
    for (const device of devicesRef.current) {
      if (deviceStatusesRef.current[device.id]?.state !== "CONNECTED") {
        connectDevice(device.id);
      }
    }
  }

  function connectConfiguredDevices(ids = []) {
    const configuredIds = new Set(ids.map((id) => String(id)));
    for (const device of devicesRef.current) {
      if (configuredIds.has(String(device.id)) && deviceStatusesRef.current[device.id]?.state !== "CONNECTED") {
        connectDevice(device.id);
      }
    }
  }

  function disconnectDevice(id) {
    const device = findDevice(id);
    if (!device) {
      return;
    }

    setDeviceStatus(id, { state: "DISCONNECTING", error: "" });
    const uuid = sendWsMessage(`/disconnect ${device.name}`);
    if (!uuid) {
      setDeviceStatus(id, { state: "CONNECTED", error: "Cannot send disconnect command" });
      return;
    }
    pendingDisconnectByUuidRef.current.set(uuid, String(id));
  }

  function updateDeviceStateFromMessage(message, uuid = "") {
    const isDeviceListResponse = pendingDeviceListUuidsRef.current.delete(uuid);
    const parsedDevices = parseDeviceList(message);
    if (parsedDevices.length || isDeviceListResponse) {
      setDeviceRows(parsedDevices);
      setDevices(parsedDevices);
      ensureStatusRows(parsedDevices);
      if (autoConnectDeviceIdsAfterDeviceListRef.current.length) {
        const pendingAutoConnectIds = [...autoConnectDeviceIdsAfterDeviceListRef.current];
        autoConnectDeviceIdsAfterDeviceListRef.current = [];
        window.setTimeout(() => connectConfiguredDevices(pendingAutoConnectIds), 0);
      }
      return;
    }

    const parsedStatuses = parseStatusList(message);
    if (parsedStatuses.length) {
      for (const status of parsedStatuses) {
        applyStatusUpdate(status);
        if (status.state === "CONNECTED") {
          requestDeviceIdentity(status.id);
        }
      }
      return;
    }

    if (message.startsWith("OK CONNECTED")) {
      const id = takePendingUuid(pendingConnectByUuidRef.current, uuid);
      if (id) {
        finishConnect(id, true);
        setDeviceStatus(id, { state: "CONNECTED", error: "" });
        requestDeviceIdentity(id);
      }
      return;
    }

    if (message.startsWith("OK DISCONNECTED")) {
      const id = takePendingUuid(pendingDisconnectByUuidRef.current, uuid)
        || takePendingUuid(pendingConnectByUuidRef.current, uuid);
      if (id) {
        finishConnect(id, false);
        setDeviceStatus(id, { state: "DISCONNECTED", error: "", identity: null });
        identityRequestedIdsRef.current = identityRequestedIdsRef.current.filter(
          (requestedId) => requestedId !== String(id),
        );
      }
      return;
    }

    if (message.startsWith("ERR ")) {
      const id = takePendingUuid(pendingConnectByUuidRef.current, uuid)
        || takePendingUuid(pendingDisconnectByUuidRef.current, uuid);
      if (id) {
        finishConnect(id, false, message);
        return;
      }
    }

    updateDeviceIdentityFromMessage(message, uuid);
  }

  function updateDeviceIdentityFromMessage(message, uuid) {
    if (isConnectionLifecycleMessage(message) || parseDeviceList(message).length) {
      return;
    }

    const id = takePendingUuid(pendingIdentityByUuidRef.current, uuid);
    if (!id) {
      return;
    }

    if (message.startsWith("ERR ")) {
      setDeviceStatus(id, { identity: null, error: message });
      return;
    }

    setDeviceStatus(id, { identity: parseDeviceIdentity(message), error: "" });
  }

  function resetDeviceState() {
    clearDeviceConnectTimeout();
    devicesRef.current = [];
    deviceByIdRef.current = new Map();
    deviceByNameRef.current = new Map();
    deviceStatusesRef.current = {};
    pendingConnectIdsRef.current = [];
    pendingConnectByUuidRef.current = new Map();
    pendingDisconnectByUuidRef.current = new Map();
    pendingDeviceListUuidsRef.current = new Set();
    pendingIdentityByUuidRef.current = new Map();
    identityRequestedIdsRef.current = [];
    autoConnectDeviceIdsAfterDeviceListRef.current = [];
    setDevices([]);
    setDeviceStatuses({});
    setDeviceConnecting(false);
    setDeviceConnectingIds([]);
    updateDeviceConnected(false);
  }

  function clearDeviceConnectTimeout() {
    if (deviceConnectTimeoutRef.current) {
      window.clearTimeout(deviceConnectTimeoutRef.current);
      deviceConnectTimeoutRef.current = null;
    }
  }

  function updateDeviceConnected(value) {
    deviceConnectedRef.current = value;
  }

  function beginConnect(id) {
    pendingConnectIdsRef.current = [...pendingConnectIdsRef.current, id];
    setDeviceStatus(id, { state: "CONNECTING", error: "" });
    updateConnectingState();
    clearDeviceConnectTimeout();
    deviceConnectTimeoutRef.current = window.setTimeout(() => {
      for (const pendingId of pendingConnectIdsRef.current) {
        setDeviceStatus(pendingId, {
          state: "DISCONNECTED",
          error: `Device connect timed out after 10 seconds: ${pendingId}`,
        });
      }
      pendingConnectIdsRef.current = [];
      pendingConnectByUuidRef.current.clear();
      updateConnectingState();
    }, CONNECTION_TIMEOUT_MS);
  }

  function finishConnect(id, connected, error = "") {
    pendingConnectIdsRef.current = pendingConnectIdsRef.current.filter(
      (pendingId) => pendingId !== id,
    );
    updateConnectingState();
    if (!pendingConnectIdsRef.current.length) {
      clearDeviceConnectTimeout();
    }
    if (error) {
      setDeviceStatus(id, { state: connected ? "CONNECTED" : "DISCONNECTED", error });
    }
  }

  function applyStatusUpdate(status) {
    if (isConnecting(status.id) && status.state !== "CONNECTED") {
      setDeviceStatus(status.id, {
        ...status,
        state: "CONNECTING",
        error: "",
      });
      return;
    }

    finishConnect(status.id, status.state === "CONNECTED");
    setDeviceStatus(status.id, { ...status, error: "" });
  }

  function setDeviceStatus(id, patch) {
    const next = {
      ...deviceStatusesRef.current,
      [id]: {
        ...(deviceStatusesRef.current[id] || EMPTY_DEVICE_STATUS),
        ...patch,
      },
    };
    deviceStatusesRef.current = next;
    setDeviceStatuses(next);
    updateDeviceConnected(countConnectedDevices(next) > 0);
  }

  function ensureStatusRows(nextDevices) {
    const next = { ...deviceStatusesRef.current };
    for (const device of nextDevices) {
      next[device.id] = next[device.id] || { ...EMPTY_DEVICE_STATUS, state: "DISCONNECTED" };
    }
    deviceStatusesRef.current = next;
    setDeviceStatuses(next);
    updateDeviceConnected(countConnectedDevices(next) > 0);
  }

  function updateConnectingState() {
    setDeviceConnectingIds([...pendingConnectIdsRef.current]);
    setDeviceConnecting(pendingConnectIdsRef.current.length > 0);
  }

  function findDevice(id) {
    return deviceByIdRef.current.get(String(id));
  }

  function requestDeviceIdentity(id) {
    const device = findDevice(id);
    const deviceId = String(id);
    if (!device || identityRequestedIdsRef.current.includes(deviceId)) {
      return;
    }

    identityRequestedIdsRef.current = [...identityRequestedIdsRef.current, deviceId];
    const uuid = sendWsMessage(`CMD ${device.name} *IDN?`);
    if (!uuid) {
      setDeviceStatus(deviceId, { identity: null, error: "Device identity query could not be sent" });
      identityRequestedIdsRef.current = identityRequestedIdsRef.current.filter(
        (pendingId) => pendingId !== deviceId,
      );
      return;
    }
    pendingIdentityByUuidRef.current.set(uuid, deviceId);
  }

  function isConnecting(id) {
    return pendingConnectIdsRef.current.includes(String(id));
  }

  function setDeviceRows(nextDevices) {
    devicesRef.current = nextDevices;
    deviceByIdRef.current = new Map(nextDevices.map((device) => [device.id, device]));
    deviceByNameRef.current = new Map(nextDevices.map((device) => [device.name, device]));
  }

  return {
    devices,
    deviceByNameRef,
    deviceStatuses,
    deviceConnected: countConnectedDevices(deviceStatuses) > 0,
    deviceConnectedRef,
    deviceConnecting,
    deviceConnectingIds,
    setDeviceConnecting,
    connectDevice,
    connectAllDevices,
    connectConfiguredDevices,
    connectAllTcpDevices: connectAllDevices,
    disconnectDevice,
    requestDevicesAndStatuses,
    updateDeviceStateFromMessage,
    resetDeviceState,
    clearDeviceConnectTimeout,
    updateDeviceConnected,
  };
}

function takePendingUuid(pendingByUuid, uuid) {
  if (!uuid) {
    return "";
  }

  const id = pendingByUuid.get(uuid) || "";
  if (id) {
    pendingByUuid.delete(uuid);
  }
  return id;
}
