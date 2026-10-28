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
/**
 * Public compatibility surface of the WebSocket connection provider.
 * @typedef {{
 *   config: {
 *     autoConnect: boolean,
 *     deviceAutoConnectIds: string[],
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
 *   setDeviceAutoConnect: Function,
 *   disconnectDevice: Function,
 *   addDevice: Function,
 *   modifyDevice: Function,
 *   deleteDevice: Function,
 *   sendScpiCommand: Function,
 *   subscribeScpiQuery: Function,
 *   subscribeScpiSnapshot: Function,
 *   getScpiQuerySnapshot: Function,
 *   refreshScpiQuery: (deviceName: string, query: string) => boolean,
 *   clearWsMessages: Function
 * }} WebSocketConnection
 */
export {};
