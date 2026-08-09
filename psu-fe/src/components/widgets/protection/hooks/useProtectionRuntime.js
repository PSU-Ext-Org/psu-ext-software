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
import {
  formatConfiguredValue,
  INITIAL_RUNTIME_STATE,
  validateDraftThreshold,
} from "../utils/protectionHelpers.js";
import {
  emitTripEventIfNeeded,
  missingSendScpiCommand,
  readFullRuntimeSnapshot,
  readTripStateSnapshot,
  sendProtectionCommand,
} from "../utils/protectionRuntime.js";

export function useProtectionRuntime({
  config,
  placementId,
  runnable,
  sendScpiCommand = missingSendScpiCommand,
}) {
  const [runtime, setRuntime] = useState(INITIAL_RUNTIME_STATE);
  const [draftValue, setDraftValue] = useState("");
  const requestVersionRef = useRef(0);
  const mountedRef = useRef(false);
  const fullRefreshPromiseRef = useRef(null);
  const pollPromiseRef = useRef(null);
  const lastTripStateRef = useRef("unknown");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestVersionRef.current += 1;
      fullRefreshPromiseRef.current = null;
      pollPromiseRef.current = null;
    };
  }, []);

  useEffect(() => {
    setDraftValue("");
    setRuntime(INITIAL_RUNTIME_STATE);
    lastTripStateRef.current = "unknown";
    requestVersionRef.current += 1;
    fullRefreshPromiseRef.current = null;
    pollPromiseRef.current = null;
  }, [
    config.channel,
    config.deviceName,
    config.disabledResponse,
    config.enableOffCommand,
    config.enableOnCommand,
    config.enableQuery,
    config.enabledResponse,
    config.protectionKey,
    config.tripQuery,
    config.valueSetTemplate,
    config.valueQuery,
  ]);

  const refreshRuntime = useCallback(async (source) => {
    if (!runnable) {
      return INITIAL_RUNTIME_STATE;
    }

    if (fullRefreshPromiseRef.current) {
      return fullRefreshPromiseRef.current;
    }

    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    setRuntime((current) => ({ ...current, loading: true, error: "" }));

    const nextRefresh = readFullRuntimeSnapshot(config, sendScpiCommand)
      .then((snapshot) => {
        if (!mountedRef.current || requestVersionRef.current !== requestVersion) {
          return snapshot;
        }

        const nextRuntime = {
          thresholdValue: snapshot.thresholdValue,
          enabledState: snapshot.enabledState,
          tripped: snapshot.tripped,
          loading: false,
          error: "",
          pollError: "",
          lastUpdatedAt: Date.now(),
        };
        setRuntime(nextRuntime);
        emitTripEventIfNeeded({
          config,
          nextRuntime,
          previousTripped: lastTripStateRef.current,
          source,
          widgetId: placementId,
        });
        lastTripStateRef.current = snapshot.tripped;
        return nextRuntime;
      })
      .catch((error) => {
        if (!mountedRef.current || requestVersionRef.current !== requestVersion) {
          throw error;
        }

        setRuntime((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : "Refresh failed.",
          lastUpdatedAt: Date.now(),
        }));
        throw error;
      })
      .finally(() => {
        if (fullRefreshPromiseRef.current === nextRefresh) {
          fullRefreshPromiseRef.current = null;
        }
      });

    fullRefreshPromiseRef.current = nextRefresh;
    return nextRefresh;
  }, [config, placementId, runnable, sendScpiCommand]);

  const pollTripState = useCallback(async () => {
    if (!runnable) {
      return INITIAL_RUNTIME_STATE;
    }

    if (pollPromiseRef.current || fullRefreshPromiseRef.current) {
      return pollPromiseRef.current || fullRefreshPromiseRef.current;
    }

    const nextPoll = readTripStateSnapshot(config, sendScpiCommand)
      .then((snapshot) => {
        if (!mountedRef.current) {
          return snapshot;
        }

        setRuntime((current) => {
          const nextRuntime = {
            ...current,
            tripped: snapshot.tripped,
            pollError: "",
            lastUpdatedAt: Date.now(),
          };
          emitTripEventIfNeeded({
            config,
            nextRuntime,
            previousTripped: lastTripStateRef.current,
            source: "poll",
            widgetId: placementId,
          });
          lastTripStateRef.current = snapshot.tripped;
          return nextRuntime;
        });

        return snapshot;
      })
      .catch((error) => {
        if (!mountedRef.current) {
          throw error;
        }

        setRuntime((current) => ({
          ...current,
          pollError: error instanceof Error ? error.message : "Trip refresh failed.",
          lastUpdatedAt: Date.now(),
        }));
        throw error;
      })
      .finally(() => {
        if (pollPromiseRef.current === nextPoll) {
          pollPromiseRef.current = null;
        }
      });

    pollPromiseRef.current = nextPoll;
    return nextPoll;
  }, [config, placementId, runnable, sendScpiCommand]);

  useEffect(() => {
    if (!runnable) {
      return undefined;
    }

    void refreshRuntime("mount");
    const intervalId = window.setInterval(() => {
      void pollTripState();
    }, Math.max(10, Math.round(1000 / config.frequencyHz)));

    return () => window.clearInterval(intervalId);
  }, [config.frequencyHz, pollTripState, refreshRuntime, runnable]);

  const handleApplyThreshold = useCallback(async () => {
    const error = validateDraftThreshold(draftValue, config, runtime.loading);
    if (!runnable || error) {
      return;
    }

    const normalizedValue = formatConfiguredValue(draftValue, config.decimals);
    setRuntime((current) => ({ ...current, loading: true, error: "" }));

    try {
      await sendProtectionCommand(
        sendScpiCommand,
        config.deviceName,
        config.valueSetTemplate.replace("{value}", normalizedValue),
      );
      setDraftValue("");
      await refreshRuntime("write-verify");
    } catch (error) {
      setRuntime((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Threshold update failed.",
      }));
    }
  }, [config, draftValue, refreshRuntime, runnable, runtime.loading, sendScpiCommand]);

  const handleToggleEnabled = useCallback(async () => {
    const command =
      runtime.enabledState === "enabled" ? config.enableOffCommand : config.enableOnCommand;
    setRuntime((current) => ({ ...current, loading: true, error: "" }));

    try {
      await sendProtectionCommand(sendScpiCommand, config.deviceName, command);
      await refreshRuntime("write-verify");
    } catch (error) {
      setRuntime((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Enable update failed.",
      }));
    }
  }, [config, refreshRuntime, runtime.enabledState, sendScpiCommand]);

  return {
    draftValue,
    handleApplyThreshold,
    handleToggleEnabled,
    runtime,
    setDraftValue,
  };
}
