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
import { countConnectedDevices, EMPTY_DEVICE_STATUS } from "./deviceRegistry.js";

/**
 * Owns device rows and statuses. Every status commit updates synchronous readers
 * before publishing to React, so consecutive messages observe the latest state.
 */
export function useDeviceRegistryState() {
  const [devices, setDevices] = useState([]);
  const [deviceStatuses, setDeviceStatuses] = useState({});
  const devicesRef = useRef([]);
  const deviceByIdRef = useRef(new Map());
  const deviceByNameRef = useRef(new Map());
  const deviceStatusesRef = useRef({});
  const deviceConnectedRef = useRef(false);

  function commitStatuses(next) {
    deviceStatusesRef.current = next;
    deviceConnectedRef.current = countConnectedDevices(next) > 0;
    setDeviceStatuses(next);
  }

  function getDevice(id) {
    return deviceByIdRef.current.get(String(id));
  }

  function getStatus(id) {
    return deviceStatusesRef.current[String(id)];
  }

  function patchStatus(id, patch) {
    commitStatuses({
      ...deviceStatusesRef.current,
      [id]: { ...(getStatus(id) || EMPTY_DEVICE_STATUS), ...patch },
    });
  }

  function replaceDevices(nextDevices) {
    devicesRef.current = nextDevices;
    deviceByIdRef.current = new Map(nextDevices.map((device) => [device.id, device]));
    deviceByNameRef.current = new Map(nextDevices.map((device) => [device.name, device]));
    setDevices(nextDevices);
    const nextStatuses = { ...deviceStatusesRef.current };
    for (const device of nextDevices) {
      nextStatuses[device.id] ||= { ...EMPTY_DEVICE_STATUS, state: "DISCONNECTED" };
    }
    commitStatuses(nextStatuses);
  }

  function reset() {
    devicesRef.current = [];
    deviceByIdRef.current.clear();
    deviceByNameRef.current.clear();
    setDevices([]);
    commitStatuses({});
  }

  return {
    devices,
    devicesRef,
    deviceByNameRef,
    deviceStatuses,
    deviceStatusesRef,
    deviceConnected: countConnectedDevices(deviceStatuses) > 0,
    deviceConnectedRef,
    getDevice,
    getStatus,
    patchStatus,
    replaceDevices,
    reset,
  };
}
