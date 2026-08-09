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
import { useScriptRunnerHttp } from "../../../connection/http-script/ScriptRunnerHttpContext.jsx";
import { useWebSocketConnection } from "../../../connection/ws-proxy/WebSocketConnectionContext.jsx";
import { ConnectionMessage } from "./components/ConnectionMessage.jsx";
import { DeviceManagerView } from "./components/DeviceManagerView.jsx";
import { useHttpDeviceManager } from "./useHttpDeviceManager.js";

const DEVICE_MANAGER_ADD_EVENT = "psu-ext-open-device-manager-add";

/**
 * Device manager selected by the placement transport mode.
 *
 * @param {{placement?: {id?: string, mode?: "ws" | "http"}}} props
 * @returns {import("react").ReactElement}
 */
export function DeviceManagerWidget({ placement = {} }) {
  return placement.mode === "http"
    ? <HttpDeviceManager placementId={placement.id} />
    : <WebSocketDeviceManager placementId={placement.id} />;
}

/**
 * Compact header action that opens the matching device-manager add dialog.
 *
 * @param {{placement: {id: string, mode?: "ws" | "http"}}} props
 * @returns {import("react").ReactElement | null}
 */
export function DeviceManagerActions({ placement }) {
  return placement.mode === "http"
    ? <HttpDeviceManagerActions placementId={placement.id} />
    : <WebSocketDeviceManagerActions placementId={placement.id} />;
}

/**
 * Shows the proxy device-management action only while the WebSocket is connected.
 *
 * @param {{placementId: string}} props
 * @returns {import("react").ReactElement | null}
 */
function WebSocketDeviceManagerActions({ placementId }) {
  const { wsConnected } = useWebSocketConnection();

  if (!wsConnected) {
    return null;
  }

  return <AddDeviceButton placementId={placementId} />;
}

/**
 * Shows the Script Runner device-management action without subscribing to WebSocket state.
 *
 * @param {{placementId: string}} props
 * @returns {import("react").ReactElement}
 */
function HttpDeviceManagerActions({ placementId }) {
  return <AddDeviceButton placementId={placementId} />;
}

/**
 * Dispatches the device-manager add request for one dashboard placement.
 *
 * @param {{placementId: string}} props
 * @returns {import("react").ReactElement}
 */
function AddDeviceButton({ placementId }) {
  function handleOpenDeviceManager() {
    window.dispatchEvent(
      new CustomEvent(DEVICE_MANAGER_ADD_EVENT, { detail: placementId }),
    );
  }

  return (
    <button
      aria-label="Add Device"
      className="control-standard inline-flex items-center bg-teal-700 px-3 font-medium text-white hover:bg-teal-800"
      onClick={handleOpenDeviceManager}
      type="button"
    >
      + Add Device
    </button>
  );
}

function WebSocketDeviceManager({ placementId }) {
  const connection = useWebSocketConnection();
  const manager = {
    devices: connection.devices,
    deviceStatuses: connection.deviceStatuses,
    deviceConnectingIds: connection.deviceConnectingIds,
    connectDevice: connection.connectDevice,
    disconnectDevice: connection.disconnectDevice,
    addDevice: connection.addDevice,
    modifyDevice: connection.modifyDevice,
    deleteDevice: connection.deleteDevice,
    autoConnectIds: connection.config.wsDeviceAutoConnectIds || connection.config.deviceAutoConnectIds || [],
    setAutoConnect: connection.setWsDeviceAutoConnect || connection.setDeviceAutoConnect,
  };

  return (
    <DeviceManagerView
      addEventName={DEVICE_MANAGER_ADD_EVENT}
      manager={manager}
      offlineMessage="WebSocket offline — connect the proxy to manage devices."
      placementId={placementId}
      ready={connection.wsConnected}
    />
  );
}

function HttpDeviceManager({ placementId }) {
  const scriptRunnerHttp = useScriptRunnerHttp();
  const manager = useHttpDeviceManager(
    scriptRunnerHttp.deviceApiUrl,
    scriptRunnerHttp.config.autoConnectIds,
  );

  if (manager.loading && !manager.devices.length) {
    return <ConnectionMessage>Loading Script Runner devices…</ConnectionMessage>;
  }

  if (manager.error) {
    return (
      <div className="grid gap-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-4 text-center text-sm text-rose-800">
        <span>Script Runner unavailable at {scriptRunnerHttp.deviceApiUrl}: {manager.error}</span>
        <button
          className="control-standard justify-self-center border border-rose-200 bg-white px-3 font-medium"
          onClick={() => manager.refresh().catch(() => {})}
          type="button"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <DeviceManagerView
      addEventName={DEVICE_MANAGER_ADD_EVENT}
      manager={{
        ...manager,
        autoConnectIds: scriptRunnerHttp.config.autoConnectIds,
        setAutoConnect: scriptRunnerHttp.setDeviceAutoConnect,
      }}
      placementId={placementId}
      ready
    />
  );
}
