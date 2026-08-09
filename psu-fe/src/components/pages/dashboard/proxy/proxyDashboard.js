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
import { Radio, Terminal } from "lucide-react";
import { DeviceManagerActions, DeviceManagerWidget } from "../../../widgets/deviceManager";
import { WebSocketConfigWidget } from "../../../widgets/webSocketConfig";
import { WebSocketMonitorWidget } from "../../../widgets/webSocketMonitor";

const LEGACY_STORAGE_KEYS = [
  "psu-ext.dashboard.config-layout.v6",
  "psu-ext.dashboard.config-layout.v7",
  "psu-ext.dashboard.config-layout.v8",
  "psu-ext.dashboard.config-layout.v9",
  "psu-ext.dashboard.config-layout.v10",
];

/** Fixed dashboard definition for proxy and device configuration. */
export const proxyDashboard = {
  identity: {
    pageId: "config-dashboard",
    storageKey: "psu-ext.dashboard.config-layout.v11",
  },
  layout: {
    defaultLayout: [
      { id: "websocket", type: "websocket", x: 0, y: 0, w: 1, h: 2 },
      { id: "websocket-monitor", type: "websocketMonitor", x: 1, y: 0, w: 2, h: 2 },
      { id: "device-list", type: "deviceList", mode: "ws", x: 0, y: 2, w: 3, h: 1 },
    ],
  },
  widgets: {
    definitions: {
      websocket: {
        icon: Radio,
        render: WebSocketConfigWidget,
        text: "Proxy endpoint settings.",
        title: "WebSocket",
      },
      websocketMonitor: {
        icon: Terminal,
        render: WebSocketMonitorWidget,
        text: "Raw websocket activity, newest messages at the bottom.",
        title: "WebSocket Monitor",
      },
      deviceList: {
        actions: DeviceManagerActions,
        render: DeviceManagerWidget,
        text: "Backend device profiles and live connection state.",
        title: "Device List",
      },
    },
    editable: false,
  },
};

/** Removes layout values written by configuration dashboard versions six through ten. */
export function clearLegacyProxyLayouts() {
  for (const storageKey of LEGACY_STORAGE_KEYS) {
    window.localStorage.removeItem(storageKey);
  }
}
