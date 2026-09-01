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
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { parseDurationSecondsToMs, TIMER_QUEUE_CHANNEL } from "../timerQueueConfig.js";
import { runTimerQueueAction, sendTimerQueueCommand } from "../utils/timerQueueCommands.js";
import {
  buildNonRunnableRuntimeMessage,
  createRuntimeFromStatusResponse,
  RUNNING_TIMER_STATE,
  updateRuntimeAfterCompletion,
} from "../utils/timerQueueStatus.js";
import {
  INITIAL_TIMER_QUEUE_RUNTIME,
  TIMER_QUEUE_RUNTIME_ACTION,
  timerQueueRuntimeReducer,
} from "../utils/timerQueueRuntimeState.js";

/**
 * Synchronizes timer queue runtime state with the selected device.
 *
 * Stale responses are ignored when a newer request starts or the configured
 * device and preset change while a request is in flight.
 *
 * @param {{config: object, device: object | undefined, runnable: boolean, sendScpiCommand: Function, wsConnected: boolean}} options - Timer configuration and connection adapter.
 * @returns {{runtime: object, displayedRemainingMs: number, progressPercent: number | null, refreshStatus: () => Promise<void>, handleTimerAction: () => Promise<void>}} Runtime view model and actions.
 */
export function useTimerQueueRuntime({ config, device, runnable, sendScpiCommand, wsConnected }) {
  const [runtime, dispatchRuntime] = useReducer(timerQueueRuntimeReducer, INITIAL_TIMER_QUEUE_RUNTIME);
  const [clockNowMs, setClockNowMs] = useState(() => Date.now());
  const targetKey = getRuntimeTargetKey(config);
  const latestTargetKeyRef = useRef(targetKey);
  const requestIdRef = useRef(0);
  latestTargetKeyRef.current = targetKey;

  const activeTimer = useMemo(
    () => config.timers.find((timer) => timer.id === runtime.activeId) || null,
    [config.timers, runtime.activeId],
  );
  const activeTimerDurationMs = activeTimer ? parseDurationSecondsToMs(activeTimer.durationSeconds) || 0 : 0;
  const displayedRemainingMs =
    runtime.state === RUNNING_TIMER_STATE && runtime.syncedAtMs > 0
      ? Math.max(0, runtime.remainingMs - Math.max(0, clockNowMs - runtime.syncedAtMs))
      : runtime.remainingMs;
  const progressPercent =
    activeTimer && activeTimerDurationMs > 0 && !runtime.desynced
      ? Math.max(0, Math.min(100, (displayedRemainingMs / activeTimerDurationMs) * 100))
      : null;

  useEffect(() => {
    if (runtime.state !== RUNNING_TIMER_STATE) {
      setClockNowMs(Date.now());
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setClockNowMs(Date.now());
    }, 200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [runtime.state]);

  const refreshStatus = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!runnable) {
      dispatchRuntime({
        message: buildNonRunnableRuntimeMessage({ wsConnected, device }),
        type: TIMER_QUEUE_RUNTIME_ACTION.NON_RUNNABLE,
      });
      return;
    }

    dispatchRuntime({
      message: "Refreshing status",
      type: TIMER_QUEUE_RUNTIME_ACTION.REQUEST_STARTED,
    });

    try {
      const result = await sendTimerQueueCommand(
        sendScpiCommand,
        config.deviceName,
        `TIM:STATUS? ${TIMER_QUEUE_CHANNEL}`,
      );
      if (!isCurrentRequest(requestId, targetKey)) {
        return;
      }

      dispatchRuntime({
        runtime: createRuntimeFromStatusResponse(result.response, config.timers),
        type: TIMER_QUEUE_RUNTIME_ACTION.STATUS_RECEIVED,
      });
    } catch (error) {
      if (!isCurrentRequest(requestId, targetKey)) {
        return;
      }

      dispatchRuntime({
        error: getErrorMessage(error, "Status refresh failed."),
        type: TIMER_QUEUE_RUNTIME_ACTION.REQUEST_FAILED,
      });
    }
  }, [config.deviceName, config.timers, device, runnable, sendScpiCommand, targetKey, wsConnected]);

  useEffect(() => {
    if (!runnable) {
      requestIdRef.current += 1;
      dispatchRuntime({ type: TIMER_QUEUE_RUNTIME_ACTION.RESET });
      return;
    }

    void refreshStatus();
  }, [refreshStatus, runnable]);

  useEffect(() => {
    if (runtime.state !== RUNNING_TIMER_STATE || displayedRemainingMs > 0 || runtime.desynced) {
      return;
    }

    const nextRuntime = updateRuntimeAfterCompletion({ configTimers: config.timers, runtime });
    if (nextRuntime) {
      dispatchRuntime({
        runtime: nextRuntime,
        type: TIMER_QUEUE_RUNTIME_ACTION.TIMER_COMPLETED,
      });
    }
  }, [config.timers, displayedRemainingMs, runtime]);

  const handleTimerAction = useCallback(async () => {
    if (!runnable || runtime.loading) {
      return;
    }

    dispatchRuntime({
      message: runtime.state === RUNNING_TIMER_STATE ? "Pausing timer" : "Applying timer queue",
      type: TIMER_QUEUE_RUNTIME_ACTION.REQUEST_STARTED,
    });

    try {
      const result = await runTimerQueueAction({
        config,
        displayedRemainingMs,
        runtime,
        sendScpiCommand,
      });
      if (result.kind === "error") {
        dispatchRuntime({
          error: result.error,
          type: TIMER_QUEUE_RUNTIME_ACTION.REQUEST_FAILED,
        });
        return;
      }

      dispatchRuntime({
        runtime: result.runtime,
        type: TIMER_QUEUE_RUNTIME_ACTION.ACTION_COMPLETED,
      });
    } catch (error) {
      dispatchRuntime({
        error: getErrorMessage(error, "Timer action failed."),
        type: TIMER_QUEUE_RUNTIME_ACTION.REQUEST_FAILED,
      });
    }
  }, [config, displayedRemainingMs, runnable, runtime, sendScpiCommand]);

  return {
    runtime,
    displayedRemainingMs,
    progressPercent,
    refreshStatus,
    handleTimerAction,
  };

  function isCurrentRequest(requestId, requestTargetKey) {
    return requestId === requestIdRef.current && requestTargetKey === latestTargetKeyRef.current;
  }
}

function getRuntimeTargetKey(config) {
  return `${config.deviceName}\u0000${JSON.stringify(config.timers)}`;
}

function getErrorMessage(error, fallbackMessage) {
  return error instanceof Error ? error.message : fallbackMessage;
}
