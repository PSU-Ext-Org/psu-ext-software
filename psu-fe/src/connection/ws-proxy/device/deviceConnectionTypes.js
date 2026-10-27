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
 * @typedef {object} DeviceRow
 * @property {string} id
 * @property {string} name
 * @property {string} type
 * @property {string} ip
 * @property {string} port
 * @property {string} baudrate
 */

/**
 * @typedef {object} DeviceStatus
 * @property {string} state
 * @property {boolean} reconnecting - Includes retry delays and attempts.
 * @property {string} error
 * @property {object | null} [identity]
 */

/**
 * Public device lifecycle facade. Mutable refs expose synchronous status to message handlers.
 * @typedef {object} DeviceConnection
 * @property {DeviceRow[]} devices
 * @property {import("react").MutableRefObject<Map<string, DeviceRow>>} deviceByNameRef
 * @property {Record<string, DeviceStatus>} deviceStatuses
 * @property {import("react").MutableRefObject<Record<string, DeviceStatus>>} deviceStatusesRef
 * @property {boolean} deviceConnected
 * @property {import("react").MutableRefObject<boolean>} deviceConnectedRef
 * @property {boolean} deviceConnecting
 * @property {string[]} deviceConnectingIds
 * @property {(id: string) => void} connectDevice
 * @property {() => void} connectAllDevices
 * @property {() => void} connectAllTcpDevices - Compatibility alias.
 * @property {(ids: string[]) => void} connectConfiguredDevices
 * @property {(id: string) => void} disconnectDevice
 * @property {(options?: {autoConnectDeviceIds?: string[]}) => void} requestDevicesAndStatuses
 * @property {(deviceName?: string, error?: string) => boolean} checkDeviceStatusAfterError
 * @property {(message: string, uuid?: string) => void} updateDeviceStateFromMessage
 * @property {() => void} resetDeviceState
 * @property {() => void} clearDeviceConnectTimeout
 */

export {};
