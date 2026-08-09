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
import { useEffect, useRef, useState } from "react";
import { hasWsConfig, normalisePath } from "../config/connectionConfig.js";
import { MONITOR_TAG } from "../monitor/monitorTagQueue.js";
import { createRequestUuid, formatWsRequest, parseWsEnvelope } from "./wsEnvelope.js";

const CONNECTION_TIMEOUT_MS = 10_000;
const WS_CONNECTING = 0;
const WS_OPEN = 1;

/**
 * Owns browser-to-proxy WebSocket lifecycle and raw message sending.
 *
 * @param {object} options
 * @param {object} options.config
 * @param {(direction: string, message: string, tag?: string) => void} options.appendWsMessage
 * @param {(uuid: string, tag: string) => void} options.trackResponseTag
 * @param {(uuid: string) => string} options.consumeResponseTag
 * @param {() => void} options.clearResponseTags
 * @param {import("react").MutableRefObject<{
 *   handleWsMessage?: (message: {type: "RES" | "BIN", uuid: string, payload: string}, tag: string) => void,
 *   requestDevicesAndStatuses?: () => void,
 *   resetDeviceState?: () => void,
 *   setDeviceConnecting?: (value: boolean) => void,
 *   updateDeviceConnected?: (value: boolean) => void
 * }>} options.callbacksRef
 * @returns {{
 *   wsConnected: boolean,
 *   wsConnectedRef: import("react").MutableRefObject<boolean>,
 *   wsConnecting: boolean,
 *   setWsConnecting: import("react").Dispatch<import("react").SetStateAction<boolean>>,
 *   connectWs: () => void,
 *   disconnectWs: () => void,
 *   sendWsMessage: (message: string, tag?: string) => string | null,
 *   clearWsConnectTimeout: () => void,
 *   clearAutoConnectStartTimeout: () => void,
 *   updateWsConnected: (value: boolean) => void,
 *   closeSocket: () => void
 * }}
 */
export function useWebSocketSession({
  config,
  appendWsMessage,
  trackResponseTag,
  consumeResponseTag,
  clearResponseTags,
  callbacksRef,
}) {
  const socketRef = useRef(null);
  const wsConnectTimeoutRef = useRef(null);
  const autoConnectStartedRef = useRef(false);
  const autoConnectStartTimeoutRef = useRef(null);
  const wsConnectedRef = useRef(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsConnecting, setWsConnecting] = useState(false);

  useEffect(() => {
    return () => {
      clearWsConnectTimeout();
      clearAutoConnectStartTimeout();
      closeSocket();
    };
  }, []);

  useEffect(() => {
    // Startup-only: use the config loaded from localStorage, not later form edits.
    if (
      autoConnectStartedRef.current ||
      autoConnectStartTimeoutRef.current ||
      !config.autoConnect ||
      !hasWsConfig(config)
    ) {
      return;
    }

    autoConnectStartTimeoutRef.current = window.setTimeout(() => {
      autoConnectStartTimeoutRef.current = null;
      autoConnectStartedRef.current = true;
      connectWs();
    }, 0);

    return clearAutoConnectStartTimeout;
  }, []);

  function connectWs() {
    if (hasActiveSocket(socketRef.current)) {
      return;
    }

    closeSocket();

    const wsUrl = `${config.wsScheme || "ws"}://${config.wsHost}:${config.wsPort}${normalisePath(
      config.wsPath,
    )}`;
    clearWsConnectTimeout();
    setWsConnecting(true);
    appendWsMessage("open", `Connecting ${wsUrl}`);

    const socket = new WebSocket(wsUrl);
    socket.binaryType = "arraybuffer";
    socketRef.current = socket;
    wsConnectTimeoutRef.current = window.setTimeout(() => {
      if (socketRef.current === socket && socket.readyState !== WebSocket.OPEN) {
        appendWsMessage("error", `WebSocket connect timed out after 10 seconds: ${wsUrl}`);
        setWsConnecting(false);
        updateWsConnected(false);
        callbacksRef.current.updateDeviceConnected?.(false);
        callbacksRef.current.setDeviceConnecting?.(false);
        callbacksRef.current.resetDeviceState?.();
        socket.close();
      }
    }, CONNECTION_TIMEOUT_MS);

    socket.addEventListener("open", () => {
      clearWsConnectTimeout();
      setWsConnecting(false);
      updateWsConnected(true);
      appendWsMessage("open", wsUrl);
      callbacksRef.current.requestDevicesAndStatuses?.();
    });

    socket.addEventListener("message", async (event) => {
      if (isBinaryMessageData(event.data)) {
        const bytes = await toArrayBuffer(event.data);
        appendWsMessage("error", `Unexpected raw binary WebSocket response (${bytes.byteLength} bytes)`);
        return;
      }

      const envelope = parseWsEnvelope(event.data);
      if (!envelope) {
        appendWsMessage("error", `Malformed WebSocket response envelope: ${String(event.data)}`);
        return;
      }

      const tag = consumeResponseTag(envelope.uuid);
      const message =
        envelope.type === "BIN" ? `[binary base64 ${envelope.payload.length} chars]` : envelope.payload;
      appendWsMessage("in", message, tag, envelope.uuid);
      callbacksRef.current.handleWsMessage?.(envelope, tag);
    });

    socket.addEventListener("close", () => {
      if (socketRef.current !== socket) {
        return;
      }

      clearWsConnectTimeout();
      setWsConnecting(false);
      updateWsConnected(false);
      callbacksRef.current.updateDeviceConnected?.(false);
      callbacksRef.current.setDeviceConnecting?.(false);
      callbacksRef.current.resetDeviceState?.();
      clearResponseTags();
      appendWsMessage("close", wsUrl);
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    });

    socket.addEventListener("error", () => {
      if (socketRef.current !== socket) {
        return;
      }

      clearWsConnectTimeout();
      setWsConnecting(false);
      updateWsConnected(false);
      callbacksRef.current.updateDeviceConnected?.(false);
      callbacksRef.current.setDeviceConnecting?.(false);
      callbacksRef.current.resetDeviceState?.();
      clearResponseTags();
      appendWsMessage("error", wsUrl);
    });
  }

  function disconnectWs() {
    closeSocket();
  }

  function sendWsMessage(message, tag = MONITOR_TAG.SYSTEM) {
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
  }

  function clearAutoConnectStartTimeout() {
    if (autoConnectStartTimeoutRef.current) {
      window.clearTimeout(autoConnectStartTimeoutRef.current);
      autoConnectStartTimeoutRef.current = null;
    }
  }

  function clearWsConnectTimeout() {
    if (wsConnectTimeoutRef.current) {
      window.clearTimeout(wsConnectTimeoutRef.current);
      wsConnectTimeoutRef.current = null;
    }
  }

  function updateWsConnected(value) {
    wsConnectedRef.current = value;
    setWsConnected(value);
  }

  function closeSocket() {
    if (socketRef.current) {
      socketRef.current.close();
    }
  }

  return {
    wsConnected,
    wsConnectedRef,
    wsConnecting,
    setWsConnecting,
    connectWs,
    disconnectWs,
    sendWsMessage,
    clearWsConnectTimeout,
    clearAutoConnectStartTimeout,
    updateWsConnected,
    closeSocket,
  };
}

function hasActiveSocket(socket) {
  return socket && (socket.readyState === WS_CONNECTING || socket.readyState === WS_OPEN);
}

function isBinaryMessageData(data) {
  return data instanceof ArrayBuffer || data instanceof Blob;
}

function toArrayBuffer(data) {
  return data instanceof ArrayBuffer ? Promise.resolve(data) : data.arrayBuffer();
}
