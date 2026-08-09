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
import { useRef } from "react";
import { createMonitorBuffer, formatMonitorLine } from "./monitorLog.js";
import { createMonitorTagQueue, MONITOR_TAG } from "./monitorTagQueue.js";

/**
 * Owns WebSocket monitor text and frontend-only UUID/tag matching.
 *
 * @returns {{
 *   getWsMessages: () => string,
 *   getWsTags: () => string[],
 *   subscribeWsMessages: (listener: () => void) => () => void,
 *   appendWsMessage: (direction: string, message: string, tag?: string, uuid?: string) => void,
 *   clearWsMessages: () => void,
 *   trackResponseTag: (uuid: string, tag: string) => void,
 *   consumeResponseTag: (uuid: string) => string,
 *   clearResponseTags: () => void
 * }}
 */
export function useMonitorLog() {
  const monitorTagQueueRef = useRef(createMonitorTagQueue());
  const monitorBufferRef = useRef(createMonitorBuffer());
  const listenersRef = useRef(new Set());

  function appendWsMessage(direction, message, tag = MONITOR_TAG.SYSTEM, uuid = "") {
    const line = formatMonitorLine(direction, message, tag, uuid);
    monitorBufferRef.current.append(line);
    notifyListeners();
  }

  function clearWsMessages() {
    monitorBufferRef.current.clear();
    notifyListeners();
  }

  function subscribeWsMessages(listener) {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }

  function notifyListeners() {
    for (const listener of listenersRef.current) {
      listener();
    }
  }

  return {
    getWsMessages: () => monitorBufferRef.current.getText(),
    getWsTags: () => monitorBufferRef.current.getTags(),
    subscribeWsMessages,
    appendWsMessage,
    clearWsMessages,
    trackResponseTag: (uuid, tag) => monitorTagQueueRef.current.track(uuid, tag),
    consumeResponseTag: (uuid) => monitorTagQueueRef.current.consume(uuid),
    clearResponseTags: () => monitorTagQueueRef.current.clear(),
  };
}
