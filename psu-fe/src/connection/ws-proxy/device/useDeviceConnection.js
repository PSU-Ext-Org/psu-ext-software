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
import { useDeviceRegistryState } from "./useDeviceRegistryState.js";
import { useDeviceCommands } from "./useDeviceCommands.js";
import { useDeviceRecovery } from "./useDeviceRecovery.js";
import { useDeviceStatusChecks } from "./useDeviceStatusChecks.js";
import { useDeviceDiscovery } from "./useDeviceDiscovery.js";
import { useDeviceIdentities } from "./useDeviceIdentities.js";
import { parseStatusList } from "./deviceRegistry.js";

/**
 * Composes registry, commands, recovery, status checks and per-device identities.
 * Device unavailability is reported to the caller; this layer does not own widget storage.
 *
 * @param {object} options
 * @param {(message: string) => string | null} options.sendWsMessage
 * @param {(direction: string, message: string) => void} options.appendWsMessage
 * @param {boolean} [options.wsConnected]
 * @param {(deviceName: string) => void} [options.onDeviceUnavailable]
 * @returns {import("./deviceConnectionTypes.js").DeviceConnection}
 */
export function useDeviceConnection({
  sendWsMessage,
  appendWsMessage,
  wsConnected = false,
  onDeviceUnavailable,
}) {
  const registry = useDeviceRegistryState();
  const recovery = useDeviceRecovery({
    wsConnected,
    statuses: registry.deviceStatuses,
    getStatus: registry.getStatus,
    retry: connectDevice,
  });
  const identities = useDeviceIdentities({
    getDevice: registry.getDevice,
    getStatus: registry.getStatus,
    patchStatus,
    sendWsMessage,
  });
  const commands = useDeviceCommands({
    getDevice: registry.getDevice,
    getStatus: registry.getStatus,
    patchStatus,
    sendWsMessage,
    allowConnect: recovery.allowConnect,
    suppress: recovery.suppress,
    onConnected: identities.request,
  });
  const discovery = useDeviceDiscovery({
    sendWsMessage,
    replaceDevices: registry.replaceDevices,
    connectConfiguredDevices,
  });
  const statusChecks = useDeviceStatusChecks({
    wsConnected,
    findByName: (name) => registry.deviceByNameRef.current.get(name),
    getStatus: registry.getStatus,
    patchStatus,
    sendWsMessage,
    appendWsMessage,
  });

  function patchStatus(id, patch) {
    const previous = registry.getStatus(id);
    if (patch.state && patch.state !== "CONNECTED" && previous?.state === "CONNECTED") {
      const device = registry.getDevice(id);
      if (device) {
        onDeviceUnavailable?.(device.name);
      }
    }
    if (patch.state) {
      patch = { ...patch, reconnecting: recovery.recordState(id, patch.state) };
      if (patch.state !== "CONNECTED") {
        identities.forget(id);
        patch.identity = null;
      }
    }
    registry.patchStatus(id, patch);
  }

  function connectDevice(id) {
    commands.connect(id);
  }

  function connectAllDevices() {
    for (const device of registry.devicesRef.current) {
      commands.connect(device.id);
    }
  }

  function connectConfiguredDevices(ids = []) {
    const configuredIds = new Set(ids.map(String));
    for (const device of registry.devicesRef.current) {
      if (configuredIds.has(device.id)) {
        commands.connect(device.id);
      }
    }
  }

  function applyStatus(status) {
    if (status.state === "CONNECTED" && recovery.isSuppressed(status.id)) {
      return;
    }
    if (commands.isConnecting(status.id) && status.state !== "CONNECTED") {
      patchStatus(status.id, { ...status, state: "CONNECTING", error: "" });
      return;
    }
    commands.finish(status.id, status.state === "CONNECTED");
    patchStatus(status.id, { ...status, error: "" });
  }

  function updateDeviceStateFromMessage(message, uuid = "") {
    statusChecks.acknowledge(uuid);
    if (discovery.handleMessage(message, uuid)) {
      return;
    }
    const statuses = parseStatusList(message);
    if (statuses.length) {
      for (const status of statuses) {
        applyStatus(status);
        if (status.state === "CONNECTED") {
          identities.request(status.id);
        }
      }
      return;
    }
    if (!commands.handleMessage(message, uuid)) {
      identities.handleMessage(message, uuid);
    }
  }

  function resetDeviceState() {
    for (const device of registry.devicesRef.current) {
      onDeviceUnavailable?.(device.name);
    }
    recovery.reset();
    commands.reset();
    discovery.reset();
    statusChecks.reset();
    identities.reset();
    registry.reset();
  }

  return {
    devices: registry.devices,
    deviceByNameRef: registry.deviceByNameRef,
    deviceStatuses: registry.deviceStatuses,
    deviceStatusesRef: registry.deviceStatusesRef,
    deviceConnected: registry.deviceConnected,
    deviceConnectedRef: registry.deviceConnectedRef,
    deviceConnecting: commands.connectingIds.length > 0,
    deviceConnectingIds: commands.connectingIds,
    connectDevice,
    connectAllDevices,
    connectAllTcpDevices: connectAllDevices,
    connectConfiguredDevices,
    disconnectDevice: commands.disconnect,
    requestDevicesAndStatuses: discovery.requestDevicesAndStatuses,
    checkDeviceStatusAfterError: statusChecks.checkDeviceStatusAfterError,
    updateDeviceStateFromMessage,
    resetDeviceState,
    clearDeviceConnectTimeout: commands.clearTimeouts,
  };
}
