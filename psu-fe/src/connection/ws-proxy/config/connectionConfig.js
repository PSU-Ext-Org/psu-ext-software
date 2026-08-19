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
import { getRuntimeWebSocketDefaults } from "../../runtime/runtimeConfig.js";

export const CONFIG_KEY = "psu-fe.config";

export const EMPTY_CONFIG = {
  autoConnect: false,
  deviceAutoConnectIds: [],
  wsDeviceAutoConnectIds: [],
  wsScheme: "ws",
  wsHost: "",
  wsPort: "",
  wsPath: "",
  deviceMode: "tcp",
  tcpHost: "",
  tcpPort: "",
  usbComPort: "",
};

/**
 * Loads connection configuration from localStorage with defaults for missing fields.
 *
 * @returns {typeof EMPTY_CONFIG}
 */
export function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY));
    if (!saved || typeof saved !== "object") {
      return defaultConfig();
    }

    const wsDeviceAutoConnectIds = Array.isArray(saved.wsDeviceAutoConnectIds)
      ? saved.wsDeviceAutoConnectIds.map((id) => String(id))
      : Array.isArray(saved.deviceAutoConnectIds)
        ? saved.deviceAutoConnectIds.map((id) => String(id))
        : EMPTY_CONFIG.wsDeviceAutoConnectIds;

    return {
      ...EMPTY_CONFIG,
      ...saved,
      deviceAutoConnectIds: wsDeviceAutoConnectIds,
      wsDeviceAutoConnectIds,
    };
  } catch {
    return defaultConfig();
  }
}

/**
 * Returns installer-provided endpoint defaults without changing browser-saved settings.
 *
 * @returns {typeof EMPTY_CONFIG}
 */
function defaultConfig() {
  return {
    ...EMPTY_CONFIG,
    ...getRuntimeWebSocketDefaults(),
  };
}

/**
 * Persists connection configuration to localStorage.
 *
 * @param {typeof EMPTY_CONFIG} config - Current connection configuration.
 */
export function saveConfigToStorage(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

/**
 * Removes persisted connection configuration.
 */
export function clearConfigStorage() {
  localStorage.removeItem(CONFIG_KEY);
}

/**
 * Whether WebSocket settings are complete enough to attempt a connection.
 *
 * @param {typeof EMPTY_CONFIG} config - Current connection configuration.
 * @returns {boolean}
 */
export function hasWsConfig(config) {
  return Boolean(config.wsHost && config.wsPort && config.wsPath);
}

/**
 * Whether TCP device settings are complete enough to attempt a connection.
 *
 * @param {typeof EMPTY_CONFIG} config - Current connection configuration.
 * @returns {boolean}
 */
export function hasTcpConfig(config) {
  return config.deviceMode === "tcp" && Boolean(config.tcpHost && config.tcpPort);
}

/**
 * Ensures a WebSocket path is empty or starts with a slash.
 *
 * @param {string} path - Configured WebSocket path.
 * @returns {string}
 */
export function normalisePath(path) {
  if (!path) {
    return "";
  }

  return path.startsWith("/") ? path : `/${path}`;
}
