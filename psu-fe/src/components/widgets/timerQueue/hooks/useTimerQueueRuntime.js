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
import { useCallback, useEffect, useMemo, useState } from "react";
import { parseDurationSecondsToMs } from "../timerQueueConfig.js";
import {
  buildNonRunnableRuntimeMessage,
  createRuntimeFromStatusResponse,
  INITIAL_TIMER_QUEUE_RUNTIME,
  runTimerQueueAction,
  RUNNING_TIMER_STATE,
  sendTimerQueueCommand,
  updateRuntimeAfterCompletion,
} from "../utils/timerQueueRuntime.js";

export function useTimerQueueRuntime({ config, device, runnable, sendScpiCommand, wsConnected }) {
  const [runtime, setRuntime] = useState(INITIAL_TIMER_QUEUE_RUNTIME);
  const [clockNowMs, setClockNowMs] = useState(() => Date.now());

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
    if (!runnable) {
      setRuntime((current) => ({
        ...current,
        loading: false,
        message: buildNonRunnableRuntimeMessage({ wsConnected, device }),
      }));
      return;
    }

    setRuntime((current) => ({
      ...current,
      loading: true,
      error: "",
      message: "Refreshing status",
    }));

    try {
      const result = await sendTimerQueueCommand(sendScpiCommand, config.deviceName, "TIM:STATUS? CH1");
      setRuntime({
        ...createRuntimeFromStatusResponse(result.response, config.timers),
        loading: false,
        error: "",
      });
    } catch (error) {
      setRuntime((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Status refresh failed.",
        message: error instanceof Error ? error.message : "Status refresh failed.",
      }));
    }
  }, [config.deviceName, config.timers, device, runnable, sendScpiCommand, wsConnected]);

  useEffect(() => {
    if (!runnable) {
      setRuntime(INITIAL_TIMER_QUEUE_RUNTIME);
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
      setRuntime(nextRuntime);
    }
  }, [config.timers, displayedRemainingMs, runtime]);

  const handleTimerAction = useCallback(async () => {
    if (!runnable || runtime.loading) {
      return;
    }

    setRuntime((current) => ({
      ...current,
      loading: true,
      error: "",
      message: runtime.state === RUNNING_TIMER_STATE ? "Pausing timer" : "Applying timer queue",
    }));

    try {
      const result = await runTimerQueueAction({
        config,
        displayedRemainingMs,
        runtime,
        sendScpiCommand,
      });
      if (result.kind === "error") {
        setRuntime((current) => ({
          ...current,
          loading: false,
          error: result.error,
          message: result.message,
        }));
        return;
      }

      setRuntime(result.runtime);
    } catch (error) {
      setRuntime((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Timer action failed.",
        message: error instanceof Error ? error.message : "Timer action failed.",
      }));
    }
  }, [config, displayedRemainingMs, runnable, runtime, sendScpiCommand]);

  return {
    runtime,
    displayedRemainingMs,
    progressPercent,
    refreshStatus,
    handleTimerAction,
  };
}
