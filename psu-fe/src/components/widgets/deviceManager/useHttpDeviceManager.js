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
import { useCallback, useEffect, useRef, useState } from "react";

const pendingDeviceListRequests = new Map();

/**
 * Provides the Script Runner HTTP implementation of the device-manager API.
 *
 * @param {string} apiUrl - Configured Script Runner device-manager URL.
 * @param {string[]} autoConnectIds - Persisted HTTP device ids to connect after the initial load.
 * @returns {object} Normalized device-manager state and actions.
 */
export function useHttpDeviceManager(apiUrl, autoConnectIds) {
  const [devices, setDevices] = useState([]);
  const [deviceStatuses, setDeviceStatuses] = useState({});
  const [deviceConnectingIds, setDeviceConnectingIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const autoConnectEndpointsRef = useRef(new Set());

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchDeviceList(apiUrl);
      const rows = Array.isArray(response) ? response : [];
      const normalized = rows.map(normalizeDeviceStatus);
      setDevices(normalized.map((row) => row.device));
      setDeviceStatuses(Object.fromEntries(normalized.map((row) => [row.device.id, row.status])));
      return normalized.map((row) => row.device);
    } catch (requestError) {
      setDevices([]);
      setDeviceStatuses({});
      setError(requestError.message);
      throw requestError;
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  const runOperation = useCallback(async (id, operation) => {
    const key = String(id);
    setDeviceConnectingIds((current) => [...new Set([...current, key])]);
    setDeviceStatuses((current) => ({
      ...current,
      [key]: { ...current[key], error: "" },
    }));
    try {
      await request(`${apiUrl}/${encodeURIComponent(id)}/${operation}`, { method: "POST" });
      await loadDevices();
    } catch (requestError) {
      setDeviceStatuses((current) => ({
        ...current,
        [key]: { ...current[key], error: requestError.message },
      }));
      throw requestError;
    } finally {
      setDeviceConnectingIds((current) => current.filter((currentId) => currentId !== key));
    }
  }, [apiUrl, loadDevices]);

  const connectDevice = useCallback((id) => runOperation(id, "connect"), [runOperation]);
  const disconnectDevice = useCallback((id) => runOperation(id, "disconnect"), [runOperation]);

  const addDevice = useCallback(async (fields) => {
    await request(apiUrl, { method: "POST", body: JSON.stringify(toHttpProfile(fields)) });
    await loadDevices();
  }, [apiUrl, loadDevices]);
  const modifyDevice = useCallback(async (id, fields) => {
    await request(`${apiUrl}/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(toHttpProfile(fields)),
    });
    await loadDevices();
  }, [apiUrl, loadDevices]);
  const deleteDevice = useCallback(async (id) => {
    await request(`${apiUrl}/${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadDevices();
  }, [apiUrl, loadDevices]);

  useEffect(() => {
    let active = true;
    loadDevices()
      .then((loadedDevices) => {
        if (!active || autoConnectEndpointsRef.current.has(apiUrl)) {
          return;
        }
        autoConnectEndpointsRef.current.add(apiUrl);
        const ids = new Set(autoConnectIds.map(String));
        return Promise.all(loadedDevices.filter((device) => ids.has(device.id)).map((device) => connectDevice(device.id)));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [apiUrl, autoConnectIds, connectDevice, loadDevices]);

  return {
    devices,
    deviceStatuses,
    deviceConnectingIds,
    loading,
    error,
    refresh: loadDevices,
    connectDevice,
    disconnectDevice,
    addDevice,
    modifyDevice,
    deleteDevice,
  };
}

/**
 * Coalesces concurrent list loads, including React Strict Mode's development-only effect replay.
 *
 * @returns {Promise<unknown>}
 */
function fetchDeviceList(apiUrl) {
  if (!pendingDeviceListRequests.has(apiUrl)) {
    const pendingRequest = request(apiUrl).finally(() => {
      pendingDeviceListRequests.delete(apiUrl);
    });
    pendingDeviceListRequests.set(apiUrl, pendingRequest);
  }
  return pendingDeviceListRequests.get(apiUrl);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...options.headers },
  });
  const text = await response.text();
  const body = text ? tryParseJson(text) : null;
  if (!response.ok) {
    throw new Error(body?.message || body?.code || text || `HTTP ${response.status}`);
  }
  return body;
}

function normalizeDeviceStatus(row) {
  const device = row?.device || {};
  const status = row?.status || {};
  return {
    device: {
      id: String(device.id), name: device.name || "", type: device.type || "",
      ip: device.ip || "", port: String(device.port || ""), baudrate: String(device.baudrate || ""),
    },
    status: { state: status.state || "DISCONNECTED", error: status.lastError || "" },
  };
}

function toHttpProfile({ name, type, ip, port, baudrate }) {
  return { name, type, ip: ip || null, port, baudrate: baudrate ? Number(baudrate) : null };
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
