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
import { useCallback, useEffect, useRef } from "react";
import { MONITOR_TAG } from "../monitor/monitorTagQueue.js";

const DEFAULT_SCPI_COMMAND_TIMEOUT_MS = 10_000;

/** Owns awaited commands, response correlation, and command-channel teardown. */
export function useScpiCommands(options) {
  const { wsConnected } = options;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const pendingScpiCommandsRef = useRef([]);
  const pendingScpiCommandIdRef = useRef(0);

  useEffect(() => {
    if (!wsConnected) rejectPendingScpiCommands("WebSocket command channel closed.");
  }, [wsConnected]);
  useEffect(() => () => rejectPendingScpiCommands("WebSocket command channel closed."), []);

  /**
   * Sends a SCPI command to a connected device.
   *
   * @param {string} command - Raw command text.
   * @param {string} deviceName - Target backend device name.
   * @param {{tag?: string, waitForResponse?: boolean, timeoutMs?: number}} [options]
   * @returns {boolean | Promise<{ok: boolean, response: string, type: "RES" | "BIN"}>} Whether the command was sent, or a response promise.
   */
  const sendScpiCommand = useCallback((command, deviceName, options = {}) => {
    const { wsConnectedRef, sendWsMessage, appendWsMessage } = optionsRef.current;
    const trimmedCommand = command.trim();
    const trimmedDeviceName = deviceName?.trim();
    const tag = options.tag || MONITOR_TAG.USER;
    if (!trimmedCommand) {
      return options.waitForResponse
        ? Promise.reject(new Error("Cannot send an empty SCPI command."))
        : false;
    }

    if (!wsConnectedRef.current || !trimmedDeviceName) {
      appendWsMessage(
        "error",
        `Cannot send SCPI command without a connected target: ${trimmedCommand}`,
      );
      return options.waitForResponse
        ? Promise.reject(new Error("Cannot send SCPI command without a connected target."))
        : false;
    }

    if (isConnectionManagementCommand(trimmedCommand)) {
      appendWsMessage("error", `SCPI command is blocked: ${trimmedCommand}`);
      return options.waitForResponse
        ? Promise.reject(new Error(`SCPI command is blocked: ${trimmedCommand}`))
        : false;
    }

    if (!options.waitForResponse) {
      return Boolean(sendWsMessage(`CMD ${trimmedDeviceName} ${trimmedCommand}`, tag));
    }

    return new Promise((resolve, reject) => {
      const id = pendingScpiCommandIdRef.current + 1;
      pendingScpiCommandIdRef.current = id;
      const pendingCommand = {
        id,
        uuid: "",
        resolve,
        reject,
        timeoutId: window.setTimeout(() => {
          removePendingScpiCommand(id);
          reject(new Error("SCPI command timed out."));
        }, Math.max(1, Number(options.timeoutMs) || DEFAULT_SCPI_COMMAND_TIMEOUT_MS)),
      };

      const uuid = sendWsMessage(`CMD ${trimmedDeviceName} ${trimmedCommand}`, tag);
      if (!uuid) {
        window.clearTimeout(pendingCommand.timeoutId);
        reject(new Error("SCPI command could not be sent."));
        return;
      }

      pendingCommand.uuid = uuid;
      pendingScpiCommandsRef.current.push(pendingCommand);
    });
  }, []);

  const resolvePendingScpiCommand = useCallback((message) => {
    const pendingIndex = pendingScpiCommandsRef.current.findIndex(
      (pendingCommand) => pendingCommand.uuid === message.uuid,
    );
    if (pendingIndex < 0) {
      return false;
    }

    const [pendingCommand] = pendingScpiCommandsRef.current.splice(pendingIndex, 1);
    if (!pendingCommand) {
      return false;
    }

    window.clearTimeout(pendingCommand.timeoutId);
    const response = message.type === "BIN" ? String(message.payload) : String(message.payload).trim();
    if (message.type === "RES" && response.startsWith("ERR ")) {
      pendingCommand.reject(new Error(response));
      return true;
    }

    pendingCommand.resolve({ ok: true, response, type: message.type });
    return true;
  }, []);

  function removePendingScpiCommand(id) {
    const pendingCommands = pendingScpiCommandsRef.current;
    const index = pendingCommands.findIndex((pendingCommand) => pendingCommand.id === id);
    if (index < 0) {
      return;
    }

    const [pendingCommand] = pendingCommands.splice(index, 1);
    window.clearTimeout(pendingCommand.timeoutId);
  }

  function rejectPendingScpiCommands(message) {
    const pendingCommands = pendingScpiCommandsRef.current;
    pendingScpiCommandsRef.current = [];
    for (const pendingCommand of pendingCommands) {
      window.clearTimeout(pendingCommand.timeoutId);
      pendingCommand.reject(new Error(message));
    }
  }

  return { sendScpiCommand, resolvePendingScpiCommand };
}

function isConnectionManagementCommand(command) {
  const normalized = command.trim().toLowerCase();
  return normalized.startsWith("/connect") || normalized.startsWith("/disconnect");
}
