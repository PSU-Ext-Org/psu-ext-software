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
import { useCallback, useEffect, useRef, useState } from "react";
import { hasWsConfig, normalisePath } from "../config/connectionConfig.js";
import { MONITOR_TAG } from "../monitor/monitorTagQueue.js";
import { createRequestUuid, formatWsRequest } from "./wsEnvelope.js";
import { bindWebSocketEvents } from "./webSocketEvents.js";

const CONNECTION_TIMEOUT_MS = 10_000;

/**
 * Owns the browser socket, startup auto-connect, and transport timeout.
 * Callbacks report transport lifecycle; device state belongs to the provider.
 * @param {object} options
 * @param {object} options.config
 * @param {import("react").MutableRefObject<{
 *   onOpen?: () => void,
 *   onUnavailable?: () => void,
 *   onMessage?: (message: object, tag: string) => void,
 * }>} options.callbacksRef
 * @param {Function} options.appendWsMessage
 * @param {Function} options.trackResponseTag
 * @param {Function} options.consumeResponseTag
 * @param {Function} options.clearResponseTags
 */
export function useWebSocketSession(options) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const socketRef = useRef(null);
  const wsConnectTimeoutRef = useRef(null);
  const autoConnectStartedRef = useRef(false);
  const autoConnectStartTimeoutRef = useRef(null);
  const wsConnectedRef = useRef(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsConnecting, setWsConnecting] = useState(false);

  const clearWsConnectTimeout = useCallback(() => {
    window.clearTimeout(wsConnectTimeoutRef.current);
    wsConnectTimeoutRef.current = null;
  }, []);

  const clearAutoConnectStartTimeout = useCallback(() => {
    window.clearTimeout(autoConnectStartTimeoutRef.current);
    autoConnectStartTimeoutRef.current = null;
  }, []);

  const updateWsConnected = useCallback((value) => {
    wsConnectedRef.current = value;
    setWsConnected(value);
  }, []);

  const closeSocket = useCallback(() => {
    socketRef.current?.close();
  }, []);

  const markUnavailable = useCallback(() => {
    clearWsConnectTimeout();
    setWsConnecting(false);
    updateWsConnected(false);
    optionsRef.current.callbacksRef.current.onUnavailable?.();
  }, [clearWsConnectTimeout, updateWsConnected]);

  const connectWs = useCallback(() => {
    const currentSocket = socketRef.current;
    if (currentSocket && [0, 1].includes(currentSocket.readyState)) return;
    closeSocket();
    const { config, appendWsMessage, consumeResponseTag, clearResponseTags } = optionsRef.current;
    const wsUrl = `${config.wsScheme || "ws"}://${config.wsHost}:${config.wsPort}${normalisePath(config.wsPath)}`;
    clearWsConnectTimeout();
    setWsConnecting(true);
    appendWsMessage("open", `Connecting ${wsUrl}`);
    const socket = new WebSocket(wsUrl);
    socket.binaryType = "arraybuffer";
    socketRef.current = socket;
    wsConnectTimeoutRef.current = window.setTimeout(() => {
      if (socketRef.current === socket && socket.readyState !== WebSocket.OPEN) {
        appendWsMessage("error", `WebSocket connect timed out after 10 seconds: ${wsUrl}`);
        markUnavailable();
        socket.close();
      }
    }, CONNECTION_TIMEOUT_MS);

    bindWebSocketEvents(socket, {
      wsUrl,
      isCurrent: () => socketRef.current === socket,
      onOpen() {
        clearWsConnectTimeout();
        setWsConnecting(false);
        updateWsConnected(true);
        appendWsMessage("open", wsUrl);
        optionsRef.current.callbacksRef.current.onOpen?.();
      },
      onMessage: (message, tag) => optionsRef.current.callbacksRef.current.onMessage?.(message, tag),
      onUnavailable: markUnavailable,
      onClosed() {
        if (socketRef.current === socket) socketRef.current = null;
      },
      appendWsMessage,
      consumeResponseTag,
      clearResponseTags,
    });
  }, [clearWsConnectTimeout, closeSocket, markUnavailable, updateWsConnected]);

  const sendWsMessage = useCallback((message, tag = MONITOR_TAG.SYSTEM) => {
    const { appendWsMessage, trackResponseTag } = optionsRef.current;
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      appendWsMessage("error", `Cannot send while websocket is disconnected: ${message}`);
      return null;
    }
    const uuid = createRequestUuid();
    socket.send(formatWsRequest(uuid, message));
    trackResponseTag(uuid, tag);
    appendWsMessage("out", message, tag, uuid);
    return uuid;
  }, []);

  useEffect(() => () => {
    clearWsConnectTimeout();
    clearAutoConnectStartTimeout();
    closeSocket();
  }, [clearWsConnectTimeout, clearAutoConnectStartTimeout, closeSocket]);

  useEffect(() => {
    // Startup-only: later form edits must not trigger auto-connect.
    const { config } = optionsRef.current;
    if (autoConnectStartedRef.current || autoConnectStartTimeoutRef.current || !config.autoConnect || !hasWsConfig(config)) {
      return undefined;
    }
    autoConnectStartTimeoutRef.current = window.setTimeout(() => {
      autoConnectStartTimeoutRef.current = null;
      autoConnectStartedRef.current = true;
      connectWs();
    }, 0);
    return clearAutoConnectStartTimeout;
  }, []);

  return {
    wsConnected, wsConnectedRef, wsConnecting, setWsConnecting,
    connectWs, disconnectWs: closeSocket, sendWsMessage,
    clearWsConnectTimeout, clearAutoConnectStartTimeout, updateWsConnected, closeSocket,
  };
}
