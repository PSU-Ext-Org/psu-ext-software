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
import { OperatorCard } from "./OperatorCard.jsx";

/**
 * Card wrapper for features that need both proxy WebSocket and device access.
 *
 * WebSocket state is checked first because device state is unknowable when the
 * browser is disconnected from psu-be-proxy.
 *
 * @param {object} props
 * @param {boolean} props.wsConnected - Whether the browser is connected to the proxy WebSocket.
 * @param {boolean} props.deviceConnected - Whether the proxy is connected to the PSU device.
 * @param {import("react").ReactNode} props.ready - Content shown when both connections are available.
 * @param {import("react").ReactNode} props.wsDisconnected - Content shown when the WebSocket is disconnected.
 * @param {import("react").ReactNode} props.deviceDisconnected - Content shown when only the device is disconnected.
 * @returns {import("react").ReactElement}
 */
export function PsuConnectionAwareCard({
  wsConnected,
  deviceConnected,
  ready,
  wsDisconnected,
  deviceDisconnected,
  ...cardProps
}) {
  let content = ready;

  if (!wsConnected) {
    content = wsDisconnected;
  } else if (!deviceConnected) {
    content = deviceDisconnected;
  }

  return <OperatorCard {...cardProps}>{content}</OperatorCard>;
}
