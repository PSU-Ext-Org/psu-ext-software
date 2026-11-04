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
import { MONITOR_TAG } from "../../../../connection/ws-proxy/monitor/monitorTagQueue.js";
import {
  buildSetValueCommand,
  validateSetValue,
  validateSetValueConfig,
} from "../utils/singleValueCommands.js";

/**
 * Owns explicit writes and refresh completion while leaving the input draft to the view.
 * Buttons indicate progress by staying disabled; visible feedback is reserved for errors.
 *
 * @param {object} options
 * @param {typeof import("../singleValueConfig.js").DEFAULT_SINGLE_VALUE_CONFIG} options.config
 * @param {boolean} options.connected - Both proxy and target device are available.
 * @param {{loading: boolean, error: string}} options.snapshot - Shared measurement state.
 * @param {(command: string, deviceName: string, options: {tag: string, waitForResponse: boolean}) => Promise<object>} options.sendScpiCommand
 * @param {(deviceName: string, query: string) => boolean} options.refreshScpiQuery
 * @returns {{disabled: boolean, message: string, sendValue: (value: string) => Promise<void>}}
 */
export function useSingleValueSet({ config, connected, snapshot, sendScpiCommand, refreshScpiQuery }) {
  const [status, setStatus] = useState({ phase: "idle", message: "" });
  const requestSequenceRef = useRef(0);
  const actionPendingRef = useRef(false);

  const configError = validateSetValueConfig(config);
  const refreshPending = status.phase === "refreshing" && snapshot.loading;
  const disabled = !connected || Boolean(configError) || status.phase === "writing" || refreshPending;
  const message = configError || status.message;

  useEffect(() => {
    requestSequenceRef.current += 1;
    actionPendingRef.current = false;
    setStatus({ phase: "idle", message: "" });

    // A reply from the old device/configuration must not start a new refresh.
    return () => {
      requestSequenceRef.current += 1;
      actionPendingRef.current = false;
    };
  }, [connected, config.deviceName, config.query, config.setValueCommand, config.defaultValue]);

  useEffect(() => {
    if (!actionPendingRef.current || status.phase !== "refreshing" || snapshot.loading) {
      return;
    }

    // Reset/cleanup invalidates this ref before a new device snapshot can finish an old action.
    actionPendingRef.current = false;

    // Finish this action once; later background polls must not disable the buttons.
    setStatus({
      phase: snapshot.error ? "error" : "idle",
      message: snapshot.error ? `Refresh failed: ${snapshot.error}` : "",
    });
  }, [status.phase, snapshot.loading, snapshot.error]);

  /**
   * Sends a validated argument; only an acknowledged write may refresh the measurement.
   *
   * @param {string} valueToSend - Input draft or configured default; never changes the input.
   * @returns {Promise<void>} Resolves after send/refresh dispatch; failures become status text.
   */
  async function sendValue(valueToSend) {
    if (disabled || actionPendingRef.current || validateSetValue(valueToSend)) {
      return;
    }

    // The ref closes the gap before React renders the disabled button.
    actionPendingRef.current = true;
    const requestSequence = ++requestSequenceRef.current;
    const command = buildSetValueCommand(config.setValueCommand, valueToSend);
    setStatus({ phase: "writing", message: "" });

    try {
      await sendScpiCommand(command, config.deviceName, {
        tag: MONITOR_TAG.GUI,
        waitForResponse: true,
      });
    } catch (error) {
      if (requestSequenceRef.current === requestSequence) {
        actionPendingRef.current = false;
        setStatus({
          phase: "error",
          message: `Set failed: ${getErrorMessage(error, "Command failed.")}`,
        });
      }

      return;
    }

    if (requestSequenceRef.current !== requestSequence) {
      return;
    }

    // A successful write remains successful even if the follow-up query fails.
    try {
      if (!refreshScpiQuery(config.deviceName, config.query)) {
        throw new Error("Measurement query could not be sent.");
      }

      setStatus({ phase: "refreshing", message: "" });
    } catch (error) {
      actionPendingRef.current = false;
      setStatus({
        phase: "error",
        message: `Refresh failed: ${getErrorMessage(error, "Query failed.")}`,
      });
    }
  }

  return { disabled, message, sendValue };
}

/**
 * Returns a useful error message even when a command rejects with a non-Error value.
 *
 * @param {unknown} error - Rejection from the command or refresh API.
 * @param {string} fallback - Message for rejections without an Error instance.
 * @returns {string} Error text suitable for the card status.
 */
function getErrorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}
