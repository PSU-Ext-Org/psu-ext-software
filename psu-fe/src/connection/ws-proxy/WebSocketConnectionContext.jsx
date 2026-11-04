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
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useConnectionConfig } from "./config/useConnectionConfig.js";
import { useDeviceConnection } from "./device/useDeviceConnection.js";
import { useDeviceManagement } from "./device/useDeviceManagement.js";
import { useDeviceIdentity } from "./identity/useDeviceIdentity.js";
import { useMonitorLog } from "./monitor/useMonitorLog.js";
import { routeConnectionMessage } from "./routeConnectionMessage.js";
import { useScpiCommands } from "./scpi/useScpiCommands.js";
import { useGlobalWidgetSubscriptions } from "./scpi/useGlobalWidgetSubscriptions.js";
import { useScpiQueryScheduler } from "./scpi/useScpiQueryScheduler.js";
import { useWebSocketSession } from "./ws/useWebSocketSession.js";
import { clearDeviceScpiHistory } from "../../components/widgets/widgetScpiHistory.js";

const WebSocketConnectionContext = createContext(null);

/**
 * Composes transport, device lifecycle, commands, and widget polling for the UI.
 * Transport callbacks use the latest owners; telemetry stays in external stores.
 * @param {{children: import("react").ReactNode}} props
 */
export function WebSocketConnectionProvider({ children }) {
  const monitor = useMonitorLog();
  const settings = useConnectionConfig(monitor.appendWsMessage);
  const { config, configRef } = settings;
  const callbacksRef = useRef({});
  const session = useWebSocketSession({ config, ...monitor, callbacksRef });
  const identity = useDeviceIdentity({ sendWsMessage: session.sendWsMessage });
  const devices = useDeviceConnection({
    wsConnected: session.wsConnected,
    sendWsMessage: session.sendWsMessage,
    appendWsMessage: monitor.appendWsMessage,
    onDeviceUnavailable: clearDeviceScpiHistory,
  });
  const management = useDeviceManagement({
    sendWsMessage: session.sendWsMessage,
    onRefresh: () => devices.requestDevicesAndStatuses(),
  });
  const deviceStateRef = useRef({ devices: [], deviceStatuses: {} });
  const scheduler = useScpiQueryScheduler({
    onScpiError: devices.checkDeviceStatusAfterError,
    sendWsMessage: session.sendWsMessage,
    wsConnectedRef: session.wsConnectedRef,
    getDeviceState: () => ({
      ...deviceStateRef.current,
      deviceStatuses: devices.deviceStatusesRef.current,
    }),
  });
  const commands = useScpiCommands({
    wsConnected: session.wsConnected,
    wsConnectedRef: session.wsConnectedRef,
    sendWsMessage: session.sendWsMessage,
    appendWsMessage: monitor.appendWsMessage,
  });
  useGlobalWidgetSubscriptions(scheduler.subscribeScpiQuery);

  useEffect(() => {
    deviceStateRef.current = {
      devices: devices.devices,
      deviceByName: devices.deviceByNameRef.current,
      deviceStatuses: devices.deviceStatuses,
    };
    scheduler.pollScpiQueries();
  }, [devices.devices, devices.deviceStatuses, scheduler.pollScpiQueries]);

  useEffect(() => {
    scheduler.pollScpiQueries();
  }, [scheduler.pollScpiQueries, session.wsConnected]);

  callbacksRef.current = {
    onMessage(message) {
      routeConnectionMessage(message, { commands, scheduler, management, identity, devices });
    },
    onOpen() {
      devices.requestDevicesAndStatuses({ autoConnectDeviceIds: configRef.current.wsDeviceAutoConnectIds });
    },
    onUnavailable() {
      management.resetDeviceManagement();
      devices.resetDeviceState();
    },
  };

  const connectWs = useCallback(() => {
    settings.saveConfig();
    session.connectWs();
  }, [settings.saveConfig, session.connectWs]);

  function clearConnectionConfig() {
    session.clearAutoConnectStartTimeout();
    session.clearWsConnectTimeout();
    devices.clearDeviceConnectTimeout();
    identity.clearDeviceIdentityTimeout();
    session.setWsConnecting(false);
    session.updateWsConnected(false);
    devices.resetDeviceState();
    settings.clearConfig();
    session.closeSocket();
  }

  const value = useMemo(() => ({
    config,
    wsConnected: session.wsConnected,
    wsConnecting: session.wsConnecting,
    devices: devices.devices,
    deviceStatuses: devices.deviceStatuses,
    deviceConnected: devices.deviceConnected,
    deviceConnecting: devices.deviceConnecting,
    deviceConnectingIds: devices.deviceConnectingIds,
    deviceIdentity: identity.deviceIdentity,
    getWsMessages: monitor.getWsMessages,
    getWsTags: monitor.getWsTags,
    subscribeWsMessages: monitor.subscribeWsMessages,
    updateConfig: settings.updateConfig,
    saveConfig: settings.saveConfig,
    clearConnectionConfig,
    connectWs,
    disconnectWs: session.disconnectWs,
    connectDevice: devices.connectDevice,
    connectAllDevices: devices.connectAllDevices,
    connectAllTcpDevices: devices.connectAllTcpDevices,
    setWsDeviceAutoConnect: settings.setWsDeviceAutoConnect,
    setDeviceAutoConnect: settings.setWsDeviceAutoConnect,
    disconnectDevice: devices.disconnectDevice,
    addDevice: management.addDevice,
    modifyDevice: management.modifyDevice,
    deleteDevice: management.deleteDevice,
    sendScpiCommand: commands.sendScpiCommand,
    subscribeScpiQuery: scheduler.subscribeScpiQuery,
    subscribeScpiSnapshot: scheduler.subscribeScpiSnapshot,
    getScpiQuerySnapshot: scheduler.getScpiQuerySnapshot,
    refreshScpiQuery: scheduler.refreshScpiQuery,
    clearWsMessages: monitor.clearWsMessages,
  }), [
    config, session.wsConnected, session.wsConnecting, devices.devices,
    devices.deviceStatuses, devices.deviceConnected, devices.deviceConnecting,
    devices.deviceConnectingIds, identity.deviceIdentity, monitor.appendWsMessage,
    settings.updateConfig, settings.saveConfig, settings.setWsDeviceAutoConnect,
    connectWs, commands.sendScpiCommand, scheduler.subscribeScpiQuery,
    scheduler.subscribeScpiSnapshot, scheduler.getScpiQuerySnapshot, scheduler.refreshScpiQuery,
  ]);

  return (
    <WebSocketConnectionContext.Provider value={value}>
      {children}
    </WebSocketConnectionContext.Provider>
  );
}

/**
 * Returns the public connection state and actions from the nearest provider.
 * @returns {import("./connectionTypes.js").WebSocketConnection}
 */
export function useWebSocketConnection() {
  const context = useContext(WebSocketConnectionContext);
  if (!context) {
    throw new Error("useWebSocketConnection must be used inside WebSocketConnectionProvider");
  }
  return context;
}
