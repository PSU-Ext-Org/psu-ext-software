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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWebSocketConnection } from "../../../../connection/ws-proxy/WebSocketConnectionContext.jsx";
import { useSingleToggleSnapshot } from "./useSingleToggleSnapshot.js";
import { getHelperText, getToggleDisplay, mapStatusResponse, validateRunnableConfig } from "../utils/singleTogglePresentation.js";
import {
  createAutoStatusKey,
  forgetAutoStatusCheck,
  missingSendScpiCommand,
  runStatusCommand,
  sendToggleCommand,
} from "../utils/singleToggleCommands.js";

const INITIAL_TOGGLE_STATUS = Object.freeze({
  state: "unknown",
  busy: false,
  message: "Waiting",
});

/** Owns toggle reads and write verification; disconnects invalidate outstanding response sequences. */
export function useSingleToggleRuntime({ placement, config }) {
  const {
    getScpiQuerySnapshot,
    subscribeScpiSnapshot,
    wsConnected,
    devices = [],
    deviceStatuses = {},
    sendScpiCommand = missingSendScpiCommand,
  } = useWebSocketConnection();
  const [status, setStatus] = useState(INITIAL_TOGGLE_STATUS);
  const requestSequenceRef = useRef(0);
  const deviceByName = useMemo(
    () => new Map(devices.map((candidate) => [candidate.name, candidate])),
    [devices],
  );
  const validationError = validateRunnableConfig(config);
  const device = deviceByName.get(config.deviceName);
  const deviceConnected = Boolean(device && deviceStatuses[device.id]?.state === "CONNECTED");
  const runnable = !validationError && wsConnected && device && deviceConnected;
  const snapshot = useSingleToggleSnapshot({
    deviceName: config.deviceName,
    query: config.statusCommand,
    getScpiQuerySnapshot,
    subscribeScpiSnapshot,
  });
  const { displayText, actionLabel } = getToggleDisplay(status.state, runnable);
  const helperText = getHelperText({
    autoRefreshEnabled: config.autoRefreshEnabled,
    device,
    deviceConnected,
    snapshot,
    status,
    validationError,
    wsConnected,
  });
  const actionDisabled = !runnable || status.busy;

  const checkStatus = useCallback(
    async ({ autoStatusKey = "", busy = true, message = "Checking status" } = {}) => {
      const sequence = requestSequenceRef.current + 1;
      requestSequenceRef.current = sequence;
      if (busy) {
        setStatus((current) => ({ ...current, busy: true, message }));
      }

      try {
        const result = await runStatusCommand({
          autoStatusKey,
          command: config.statusCommand,
          deviceName: config.deviceName,
          sendScpiCommand,
        });
        const nextState = mapStatusResponse(result.response, config);
        if (requestSequenceRef.current === sequence) {
          setStatus({
            state: nextState,
            busy: false,
            message: nextState === "unknown" ? `Unexpected response: ${result.response}` : "Ready",
          });
        }
        return requestSequenceRef.current === sequence ? nextState : "unknown";
      } catch (error) {
        if (requestSequenceRef.current === sequence) {
          setStatus({
            state: "unknown",
            busy: false,
            message: error instanceof Error ? error.message : "Status check failed.",
          });
        }
        return "unknown";
      }
    },
    [config, sendScpiCommand],
  );

  useEffect(() => {
    requestSequenceRef.current += 1;
    if (!runnable) {
      setStatus(INITIAL_TOGGLE_STATUS);
      forgetAutoStatusCheck(placement.id, config);
      return undefined;
    }

    checkStatus({
      autoStatusKey: createAutoStatusKey(placement.id, config),
      busy: true,
      message: "Checking status",
    });
    return () => {
      requestSequenceRef.current += 1;
    };
  }, [checkStatus, config, placement.id, runnable]);

  useEffect(() => {
    if (!runnable || !config.autoRefreshEnabled || status.busy || !snapshot.updatedAt) {
      return;
    }

    const nextState = mapStatusResponse(snapshot.value, config);
    setStatus((current) => {
      if (current.busy) {
        return current;
      }

      const nextMessage = nextState === "unknown" ? `Unexpected response: ${snapshot.value}` : "Ready";
      if (current.state === nextState && current.message === nextMessage) {
        return current;
      }

      return {
        state: nextState,
        busy: false,
        message: nextMessage,
      };
    });
  }, [config, runnable, snapshot.updatedAt, snapshot.value, status.busy]);

  return { status, displayText, helperText, actionLabel, actionDisabled, handleToggle };

  async function handleToggle() {
    if (!runnable || status.busy) {
      return;
    }

    if (status.state !== "on" && status.state !== "off") {
      await checkStatus({ busy: true, message: "Checking status" });
      return;
    }

    const targetState = status.state === "on" ? "off" : "on";
    const preChangeState = await checkStatus({ busy: true, message: "Checking before change" });
    if (preChangeState === "unknown") {
      return;
    }

    if (preChangeState === targetState) {
      setStatus({ state: targetState, busy: false, message: "Ready" });
      return;
    }

    const sequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = sequence;
    setStatus((current) => ({ ...current, busy: true, message: `Turning ${targetState}` }));

    try {
      await sendToggleCommand(
        sendScpiCommand,
        config.deviceName,
        targetState === "on" ? config.onCommand : config.offCommand,
      );
      const verifiedState = requestSequenceRef.current === sequence
        ? await checkStatus({ busy: true, message: "Verifying status" })
        : "unknown";
      if (verifiedState !== targetState && requestSequenceRef.current === sequence + 1) {
        setStatus({
          state: verifiedState,
          busy: false,
          message: `Verification failed: expected ${targetState.toUpperCase()}.`,
        });
      }
    } catch (error) {
      if (requestSequenceRef.current === sequence) {
        setStatus({
          state: preChangeState,
          busy: false,
          message: error instanceof Error ? error.message : "Toggle command failed.",
        });
      }
    }
  }
}
