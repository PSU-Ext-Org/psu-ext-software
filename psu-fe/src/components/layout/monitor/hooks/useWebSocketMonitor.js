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
import { useSyncExternalStore } from "react";
import { useWebSocketConnection } from "../../../../connection/ws-proxy/WebSocketConnectionContext.jsx";
import { useMonitorCommand } from "./useMonitorCommand.js";
import { useMonitorLog } from "./useMonitorLog.js";
import { useMonitorTags } from "./useMonitorTags.js";

/**
 * Combines focused monitor state hooks into the view models consumed by the monitor UI.
 *
 * @returns {object} View models for the monitor log, tag filters, and command form.
 */
export function useWebSocketMonitor() {
  const connection = useWebSocketConnection();
  const {
    wsConnected,
    devices = [],
    deviceStatuses = {},
    getWsMessages,
    getWsTags,
    subscribeWsMessages,
    sendScpiCommand,
    clearWsMessages,
  } = connection;
  const wsMessages = useSyncExternalStore(
    subscribeWsMessages,
    getWsMessages,
    getWsMessages,
  );
  const tags = useMonitorTags(wsMessages, getWsTags);
  const log = useMonitorLog(wsMessages, tags.text, clearWsMessages);
  const command = useMonitorCommand({
    deviceStatuses,
    devices,
    onCommandSent: tags.includeUserTag,
    sendScpiCommand,
    wsConnected,
  });

  return {
    command,
    filters: tags.filters,
    log,
  };
}
