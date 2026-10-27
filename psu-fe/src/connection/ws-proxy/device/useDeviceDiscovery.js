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
import { parseDeviceList } from "./deviceRegistry.js";

/**
 * Owns registry request correlation and deferred startup auto-connect.
 * Deferred work is cancelled on reset/unmount so it cannot leak into another session.
 */
export function useDeviceDiscovery({ sendWsMessage, replaceDevices, connectConfiguredDevices }) {
  const pendingLists = useRef(new Set());
  const autoConnectIds = useRef([]);
  const autoConnectTimers = useRef(new Set());
  const latestConnect = useRef(connectConfiguredDevices);
  latestConnect.current = connectConfiguredDevices;

  useEffect(() => reset, []);

  function requestDevicesAndStatuses({ autoConnectDeviceIds = [] } = {}) {
    autoConnectIds.current = Array.isArray(autoConnectDeviceIds)
      ? autoConnectDeviceIds.map(String)
      : [];
    const uuid = sendWsMessage("/device-list");
    if (uuid) {
      pendingLists.current.add(uuid);
    }
    sendWsMessage("/status");
  }

  function handleMessage(message, uuid) {
    const isListResponse = pendingLists.current.delete(uuid);
    const devices = parseDeviceList(message);
    if (!devices.length && !isListResponse) {
      return false;
    }
    replaceDevices(devices);
    if (autoConnectIds.current.length) {
      const ids = [...autoConnectIds.current];
      autoConnectIds.current = [];
      const timer = window.setTimeout(() => {
        autoConnectTimers.current.delete(timer);
        latestConnect.current(ids);
      }, 0);
      autoConnectTimers.current.add(timer);
    }
    return true;
  }

  function reset() {
    pendingLists.current.clear();
    autoConnectIds.current = [];
    for (const timer of autoConnectTimers.current) {
      window.clearTimeout(timer);
    }
    autoConnectTimers.current.clear();
  }

  return { requestDevicesAndStatuses, handleMessage, reset };
}
