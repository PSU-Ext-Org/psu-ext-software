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
export const EMPTY_DEVICE_STATUS = {
  state: "UNKNOWN",
  error: "",
};

/**
 * Parses newline-separated `/device-list` rows.
 *
 * @param {string} message - Raw websocket message.
 * @returns {{id: string, name: string, type: string, ip: string, port: string, baudrate: string}[]}
 */
export function parseDeviceList(message) {
  return message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseDeviceRow)
    .filter(Boolean);
}

/**
 * Parses newline-separated `/status` rows.
 *
 * @param {string} message - Raw websocket message.
 * @returns {{id: string, name: string, state: string, transport: string, host: string, port: string}[]}
 */
export function parseStatusList(message) {
  return message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("STATUS "))
    .map(parseStatusRow)
    .filter(Boolean);
}

/**
 * Counts statuses currently marked connected.
 *
 * @param {Record<string, {state?: string}>} statuses - Statuses keyed by device id.
 * @returns {number}
 */
export function countConnectedDevices(statuses = {}) {
  return Object.values(statuses).filter((status) => status?.state === "CONNECTED").length;
}

/**
 * Returns devices whose current status is connected.
 *
 * @param {{id: string}[]} devices - Device profiles.
 * @param {Record<string, {state?: string}>} statuses - Statuses keyed by device id.
 * @returns {{id: string}[]}
 */
export function connectedDevices(devices = [], statuses = {}) {
  return devices.filter((device) => statuses[device.id]?.state === "CONNECTED");
}

function parseDeviceRow(line) {
  const parts = line.split(",", -1).map((part) => part.trim());
  if (parts.length !== 6 || !/^\d+$/.test(parts[0])) {
    return null;
  }

  const [id, name, type, ip, port, baudrate] = parts;
  const numericId = Number(id);
  if (numericId < 0 || numericId > 255 || !/^[A-Z0-9]{1,8}$/.test(name) || !["TCP", "USB"].includes(type)) {
    return null;
  }

  return { id, name, type, ip, port, baudrate };
}

function parseStatusRow(line) {
  const fields = Object.fromEntries(
    line
      .slice("STATUS ".length)
      .split(/\s+/)
      .map((part) => part.split("="))
      .filter(([key, value]) => key && value !== undefined),
  );

  if (!fields.id || !fields.name || !fields.state) {
    return null;
  }

  return {
    id: fields.id,
    name: fields.name,
    state: fields.state,
    transport: fields.transport || "",
    host: fields.host || "",
    port: fields.port || "",
  };
}
