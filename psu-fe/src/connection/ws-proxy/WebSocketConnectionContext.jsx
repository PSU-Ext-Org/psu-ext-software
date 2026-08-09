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
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  clearConfigStorage,
  EMPTY_CONFIG,
  loadConfig,
  saveConfigToStorage,
} from "./config/connectionConfig.js";
import { useDeviceConnection } from "./device/useDeviceConnection.js";
import { useDeviceManagement } from "./device/useDeviceManagement.js";
import { useDeviceIdentity } from "./identity/useDeviceIdentity.js";
import { useMonitorLog } from "./monitor/useMonitorLog.js";
import { MONITOR_TAG } from "./monitor/monitorTagQueue.js";
import { useScpiQueryScheduler } from "./scpi/useScpiQueryScheduler.js";
import { useWebSocketSession } from "./ws/useWebSocketSession.js";
import { WIDGET_CONFIG_CHANGE_EVENT } from "../../components/widgets/widgetConfigStore.js";
import { getAllRunnableWidgetSubscriptions } from "../../components/widgets/widgetConfigRegistry.js";

const WebSocketConnectionContext = createContext(null);
const DEFAULT_SCPI_COMMAND_TIMEOUT_MS = 10_000;

/**
 * Provides shared connection state and actions for the operator UI.
 *
 * This is the single owner of browser-to-proxy WebSocket state, proxy-to-device
 * status, persisted connection configuration, and the raw WebSocket monitor log.
 * Pages and widgets should read this state through {@link useWebSocketConnection}
 * instead of passing long prop chains through `App`.
 *
 * @param {object} props
 * @param {import("react").ReactNode} props.children - Routed page content.
 * @returns {import("react").ReactElement}
 */
export function WebSocketConnectionProvider({ children }) {
  const [config, setConfig] = useState(loadConfig);
  const configRef = useRef(config);
  const deviceStateRef = useRef({ devices: [], deviceStatuses: {} });
  const globalScpiUnsubscribersRef = useRef([]);
  const pendingScpiCommandsRef = useRef([]);
  const pendingScpiCommandIdRef = useRef(0);
  const wsCallbacksRef = useRef({});
  const monitor = useMonitorLog();
  const wsSession = useWebSocketSession({
    config,
    appendWsMessage: monitor.appendWsMessage,
    trackResponseTag: monitor.trackResponseTag,
    consumeResponseTag: monitor.consumeResponseTag,
    clearResponseTags: monitor.clearResponseTags,
    callbacksRef: wsCallbacksRef,
  });
  const deviceIdentity = useDeviceIdentity({ sendWsMessage: wsSession.sendWsMessage });
  const deviceConnection = useDeviceConnection({
    sendWsMessage: wsSession.sendWsMessage,
    appendWsMessage: monitor.appendWsMessage,
  });
  const deviceManagement = useDeviceManagement({
    sendWsMessage: wsSession.sendWsMessage,
    onRefresh: () => deviceConnection.requestDevicesAndStatuses(),
  });
  const scpiScheduler = useScpiQueryScheduler({
    sendWsMessage: wsSession.sendWsMessage,
    wsConnectedRef: wsSession.wsConnectedRef,
    getDeviceState: () => deviceStateRef.current,
  });

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    deviceStateRef.current = {
      devices: deviceConnection.devices,
      deviceByName: deviceConnection.deviceByNameRef.current,
      deviceStatuses: deviceConnection.deviceStatuses,
    };
    scpiScheduler.pollScpiQueries();
  }, [deviceConnection.devices, deviceConnection.deviceStatuses, scpiScheduler.pollScpiQueries]);

  useEffect(() => {
    scpiScheduler.pollScpiQueries();
  }, [scpiScheduler.pollScpiQueries, wsSession.wsConnected]);

  useEffect(() => {
    if (!wsSession.wsConnected) {
      rejectPendingScpiCommands("WebSocket command channel closed.");
    }
  }, [wsSession.wsConnected]);

  useEffect(() => {
    function syncGlobalWidgetSubscriptions() {
      for (const unsubscribe of globalScpiUnsubscribersRef.current) {
        unsubscribe();
      }

      globalScpiUnsubscribersRef.current = getAllRunnableWidgetSubscriptions()
        .map((subscription) => scpiScheduler.subscribeScpiQuery(subscription));
    }

    syncGlobalWidgetSubscriptions();
    window.addEventListener(WIDGET_CONFIG_CHANGE_EVENT, syncGlobalWidgetSubscriptions);
    window.addEventListener("storage", syncGlobalWidgetSubscriptions);

    return () => {
      window.removeEventListener(WIDGET_CONFIG_CHANGE_EVENT, syncGlobalWidgetSubscriptions);
      window.removeEventListener("storage", syncGlobalWidgetSubscriptions);
      for (const unsubscribe of globalScpiUnsubscribersRef.current) {
        unsubscribe();
      }
      globalScpiUnsubscribersRef.current = [];
    };
  }, [scpiScheduler.subscribeScpiQuery]);

  useEffect(() => {
    return () => {
      rejectPendingScpiCommands("WebSocket command channel closed.");
    };
  }, []);

  wsCallbacksRef.current = {
    handleWsMessage(message, tag) {
      if (resolvePendingScpiCommand(message)) {
        return;
      }
      if (message.type === "RES" && scpiScheduler.handleScpiSchedulerMessage(message)) {
        return;
      }
      if (message.type === "BIN" && scpiScheduler.handleScpiSchedulerBinaryMessage(message)) {
        return;
      }
      if (deviceManagement.updateDeviceManagementFromMessage(message.payload, message.uuid)) {
        return;
      }
      deviceIdentity.updateDeviceIdentityFromMessage(message.payload);
      deviceConnection.updateDeviceStateFromMessage(message.payload, message.uuid);
    },
    requestDevicesAndStatuses() {
      deviceConnection.requestDevicesAndStatuses({
        autoConnectDeviceIds: configRef.current.wsDeviceAutoConnectIds,
      });
    },
    resetDeviceState() {
      deviceManagement.resetDeviceManagement();
      deviceConnection.resetDeviceState();
    },
    setDeviceConnecting: deviceConnection.setDeviceConnecting,
    updateDeviceConnected: deviceConnection.updateDeviceConnected,
  };

  /**
   * Updates one connection config field in memory.
   *
   * `autoConnect` and `wsDeviceAutoConnectIds` are persisted immediately. Other changes stay in memory until
   * {@link connectWsAndSaveConfig} or {@link saveConfig} is called.
   *
   * @param {"autoConnect" | "wsDeviceAutoConnectIds" | "wsScheme" | "wsHost" | "wsPort" | "wsPath"} key
   * @param {boolean | string | string[]} value
   */
  function updateConfig(key, value) {
    setConfig((current) => {
      const nextConfig = { ...current, [key]: value };
      if (key === "autoConnect" || key === "wsDeviceAutoConnectIds") {
        saveConfigToStorage(nextConfig);
        monitor.appendWsMessage(
          "config",
          key === "autoConnect"
            ? `Saved connection config to localStorage (${value ? "proxy auto-connect enabled" : "proxy auto-connect disabled"})`
            : "Saved connection config to localStorage (device auto-connect updated)",
        );
      }
      return nextConfig;
    });
  }

  /**
   * Enables or disables auto-connect for one backend device id.
   *
   * @param {string} id
   * @param {boolean} enabled
   */
  function setWsDeviceAutoConnect(id, enabled) {
    setDeviceAutoConnect("wsDeviceAutoConnectIds", id, enabled);
  }

  function setDeviceAutoConnect(key, id, enabled) {
    const normalizedId = String(id);
    setConfig((current) => {
      const currentIds = Array.isArray(current[key]) ? current[key] : [];
      const nextIds = enabled
        ? Array.from(new Set([...currentIds, normalizedId]))
        : currentIds.filter((deviceId) => deviceId !== normalizedId);
      const nextConfig = {
        ...current,
        [key]: nextIds,
        ...(key === "wsDeviceAutoConnectIds" ? { deviceAutoConnectIds: nextIds } : {}),
      };
      saveConfigToStorage(nextConfig);
      monitor.appendWsMessage(
        "config",
        `Saved connection config to localStorage (${enabled ? `device ${normalizedId} auto-connect enabled` : `device ${normalizedId} auto-connect disabled`})`,
      );
      return nextConfig;
    });
  }

  /**
   * Persists the current connection config to localStorage.
   */
  function saveConfig() {
    saveConfigToStorage(config);
    monitor.appendWsMessage("config", "Saved connection config to localStorage");
  }

  /**
   * Persists the current connection config, then attempts the WebSocket connection.
   */
  function connectWsAndSaveConfig() {
    saveConfigToStorage(configRef.current);
    monitor.appendWsMessage("config", "Saved connection config to localStorage");
    wsSession.connectWs();
  }

  /**
   * Disconnects active transports and clears connection settings in memory and storage.
   */
  function clearConnectionConfig() {
    wsSession.clearAutoConnectStartTimeout();
    wsSession.clearWsConnectTimeout();
    deviceConnection.clearDeviceConnectTimeout();
    deviceIdentity.clearDeviceIdentityTimeout();
    wsSession.setWsConnecting(false);
    wsSession.updateWsConnected(false);
    deviceConnection.resetDeviceState();
    setConfig(EMPTY_CONFIG);
    configRef.current = EMPTY_CONFIG;
    clearConfigStorage();
    monitor.appendWsMessage("config", "Cleared connection config");
    wsSession.closeSocket();
  }

  /**
   * Sends a SCPI command to a connected device.
   *
   * @param {string} command - Raw command text.
   * @param {string} deviceName - Target backend device name.
   * @param {{tag?: string, waitForResponse?: boolean, timeoutMs?: number}} [options]
 * @returns {boolean | Promise<{ok: boolean, response: string, type: "RES" | "BIN"}>} Whether the command was sent, or a response promise.
   */
  function sendScpiCommand(command, deviceName, options = {}) {
    const trimmedCommand = command.trim();
    const trimmedDeviceName = deviceName?.trim();
    const tag = options.tag || MONITOR_TAG.USER;
    if (!trimmedCommand) {
      return options.waitForResponse
        ? Promise.reject(new Error("Cannot send an empty SCPI command."))
        : false;
    }

    if (!wsSession.wsConnectedRef.current || !trimmedDeviceName) {
      monitor.appendWsMessage(
        "error",
        `Cannot send SCPI command without a connected target: ${trimmedCommand}`,
      );
      return options.waitForResponse
        ? Promise.reject(new Error("Cannot send SCPI command without a connected target."))
        : false;
    }

    if (isConnectionManagementCommand(trimmedCommand)) {
      monitor.appendWsMessage("error", `SCPI command is blocked: ${trimmedCommand}`);
      return options.waitForResponse
        ? Promise.reject(new Error(`SCPI command is blocked: ${trimmedCommand}`))
        : false;
    }

    if (!options.waitForResponse) {
      return Boolean(wsSession.sendWsMessage(`CMD ${trimmedDeviceName} ${trimmedCommand}`, tag));
    }

    return new Promise((resolve, reject) => {
      const id = pendingScpiCommandIdRef.current + 1;
      pendingScpiCommandIdRef.current = id;
      const pendingCommand = {
        id,
        uuid: "",
        resolve,
        reject,
        timeoutId: window.setTimeout(() => {
          removePendingScpiCommand(id);
          reject(new Error("SCPI command timed out."));
        }, Math.max(1, Number(options.timeoutMs) || DEFAULT_SCPI_COMMAND_TIMEOUT_MS)),
      };

      const uuid = wsSession.sendWsMessage(`CMD ${trimmedDeviceName} ${trimmedCommand}`, tag);
      if (!uuid) {
        removePendingScpiCommand(id);
        reject(new Error("SCPI command could not be sent."));
        return;
      }

      pendingCommand.uuid = uuid;
      pendingScpiCommandsRef.current.push(pendingCommand);
    });
  }

  function resolvePendingScpiCommand(message) {
    const pendingIndex = pendingScpiCommandsRef.current.findIndex(
      (pendingCommand) => pendingCommand.uuid === message.uuid,
    );
    if (pendingIndex < 0) {
      return false;
    }

    const [pendingCommand] = pendingScpiCommandsRef.current.splice(pendingIndex, 1);
    if (!pendingCommand) {
      return false;
    }

    window.clearTimeout(pendingCommand.timeoutId);
    const response = message.type === "BIN" ? String(message.payload) : String(message.payload).trim();
    if (message.type === "RES" && response.startsWith("ERR ")) {
      pendingCommand.reject(new Error(response));
      return true;
    }

    pendingCommand.resolve({ ok: true, response, type: message.type });
    return true;
  }

  function removePendingScpiCommand(id) {
    const pendingCommands = pendingScpiCommandsRef.current;
    const index = pendingCommands.findIndex((pendingCommand) => pendingCommand.id === id);
    if (index < 0) {
      return;
    }

    const [pendingCommand] = pendingCommands.splice(index, 1);
    window.clearTimeout(pendingCommand.timeoutId);
  }

  function rejectPendingScpiCommands(message) {
    const pendingCommands = pendingScpiCommandsRef.current;
    pendingScpiCommandsRef.current = [];
    for (const pendingCommand of pendingCommands) {
      window.clearTimeout(pendingCommand.timeoutId);
      pendingCommand.reject(new Error(message));
    }
  }

  const value = useMemo(
    () => ({
      config,
      wsConnected: wsSession.wsConnected,
      wsConnecting: wsSession.wsConnecting,
      devices: deviceConnection.devices,
      deviceStatuses: deviceConnection.deviceStatuses,
      deviceConnected: deviceConnection.deviceConnected,
      deviceConnecting: deviceConnection.deviceConnecting,
      deviceConnectingIds: deviceConnection.deviceConnectingIds,
      deviceIdentity: deviceIdentity.deviceIdentity,
      getWsMessages: monitor.getWsMessages,
      getWsTags: monitor.getWsTags,
      subscribeWsMessages: monitor.subscribeWsMessages,
      updateConfig,
      saveConfig,
      clearConnectionConfig,
      connectWs: connectWsAndSaveConfig,
      disconnectWs: wsSession.disconnectWs,
      connectDevice: deviceConnection.connectDevice,
      connectAllDevices: deviceConnection.connectAllDevices,
      connectAllTcpDevices: deviceConnection.connectAllTcpDevices,
      setWsDeviceAutoConnect,
      setDeviceAutoConnect: setWsDeviceAutoConnect,
      disconnectDevice: deviceConnection.disconnectDevice,
      addDevice: deviceManagement.addDevice,
      modifyDevice: deviceManagement.modifyDevice,
      deleteDevice: deviceManagement.deleteDevice,
      sendScpiCommand,
      subscribeScpiQuery: scpiScheduler.subscribeScpiQuery,
      subscribeScpiSnapshot: scpiScheduler.subscribeScpiSnapshot,
      getScpiQuerySnapshot: scpiScheduler.getScpiQuerySnapshot,
      clearWsMessages: monitor.clearWsMessages,
    }),
    [
      config,
      wsSession.wsConnected,
      wsSession.wsConnecting,
      deviceConnection.devices,
      deviceConnection.deviceStatuses,
      deviceConnection.deviceConnected,
      deviceConnection.deviceConnecting,
      deviceConnection.deviceConnectingIds,
      deviceIdentity.deviceIdentity,
      monitor.appendWsMessage,
      scpiScheduler.subscribeScpiQuery,
      scpiScheduler.subscribeScpiSnapshot,
      scpiScheduler.getScpiQuerySnapshot,
    ],
  );

  return (
    <WebSocketConnectionContext.Provider value={value}>
      {children}
    </WebSocketConnectionContext.Provider>
  );
}

/**
 * Returns the shared connection state/actions.
 *
 * @returns {{
 *   config: {
 *     autoConnect: boolean,
 *     wsDeviceAutoConnectIds: string[],
 *     wsScheme: string,
 *     wsHost: string,
 *     wsPort: string,
 *     wsPath: string,
 *     deviceMode: string,
 *     tcpHost: string,
 *     tcpPort: string,
 *     usbComPort: string
 *   },
 *   wsConnected: boolean,
 *   wsConnecting: boolean,
 *   devices: Array,
 *   deviceStatuses: Object,
 *   deviceConnected: boolean,
 *   deviceConnecting: boolean,
 *   deviceConnectingIds: string[],
 *   deviceIdentity: {
 *     manufacturer: string,
 *     model: string,
 *     serialNumber: string,
 *     firmwareLevel: string,
 *     name: string,
 *     raw: string,
 *     valid: boolean,
 *     error: string | null
 *   },
 *   getWsMessages: Function,
 *   getWsTags: Function,
 *   subscribeWsMessages: Function,
 *   updateConfig: Function,
 *   saveConfig: Function,
 *   clearConnectionConfig: Function,
 *   connectWs: Function,
 *   disconnectWs: Function,
 *   connectDevice: Function,
 *   connectAllDevices: Function,
 *   connectAllTcpDevices: Function,
 *   setWsDeviceAutoConnect: Function,
 *   disconnectDevice: Function,
 *   addDevice: Function,
 *   deleteDevice: Function,
 *   sendScpiCommand: Function,
 *   subscribeScpiQuery: Function,
 *   subscribeScpiSnapshot: Function,
 *   getScpiQuerySnapshot: Function,
 *   clearWsMessages: Function
 * }}
 */
export function useWebSocketConnection() {
  const context = useContext(WebSocketConnectionContext);

  if (!context) {
    throw new Error(
      "useWebSocketConnection must be used inside WebSocketConnectionProvider",
    );
  }

  return context;
}

function isConnectionManagementCommand(command) {
  const normalized = command.trim().toLowerCase();
  return normalized.startsWith("/connect") || normalized.startsWith("/disconnect");
}
