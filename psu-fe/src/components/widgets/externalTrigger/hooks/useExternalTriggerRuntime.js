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
  INITIAL_TRIGGER_RUNTIME_STATE,
  TRIGGER_SLOT_DEFINITIONS,
} from "../utils/triggerHelpers.js";
import {
  interpolateSetupCommand,
  missingSendScpiCommand,
  readTriggerSlotsSnapshot,
  sendExternalTriggerCommand,
} from "../utils/triggerRuntime.js";

export function useExternalTriggerRuntime({
  config,
  runnable,
  sendScpiCommand = missingSendScpiCommand,
}) {
  const [runtime, setRuntime] = useState(INITIAL_TRIGGER_RUNTIME_STATE);
  const requestVersionRef = useRef(0);
  const mountedRef = useRef(false);
  const refreshPromiseRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestVersionRef.current += 1;
      refreshPromiseRef.current = null;
    };
  }, []);

  useEffect(() => {
    setRuntime(INITIAL_TRIGGER_RUNTIME_STATE);
    requestVersionRef.current += 1;
    refreshPromiseRef.current = null;
  }, [
    config.actionOptions,
    config.deviceName,
    config.setupCommandTemplate,
    config.statusQueryTemplate,
  ]);

  const refreshRuntime = useCallback(async () => {
    if (!runnable) {
      return INITIAL_TRIGGER_RUNTIME_STATE;
    }

    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    setRuntime((current) => ({ ...current, loading: true, error: "" }));

    const nextRefresh = readTriggerSlotsSnapshot(config, sendScpiCommand)
      .then((slots) => {
        if (!mountedRef.current || requestVersionRef.current !== requestVersion) {
          return slots;
        }

        const nextRuntime = {
          slots: {
            ...INITIAL_TRIGGER_RUNTIME_STATE.slots,
            ...slots,
          },
          loading: false,
          error: "",
          lastUpdatedAt: Date.now(),
        };
        setRuntime(nextRuntime);
        return nextRuntime;
      })
      .catch((error) => {
        if (!mountedRef.current || requestVersionRef.current !== requestVersion) {
          throw error;
        }

        setRuntime((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : "Trigger refresh failed.",
          lastUpdatedAt: Date.now(),
        }));
        throw error;
      })
      .finally(() => {
        if (refreshPromiseRef.current === nextRefresh) {
          refreshPromiseRef.current = null;
        }
      });

    refreshPromiseRef.current = nextRefresh;
    return nextRefresh;
  }, [config, runnable, sendScpiCommand]);

  useEffect(() => {
    if (!runnable) {
      return undefined;
    }

    void refreshRuntime();
    return undefined;
  }, [refreshRuntime, runnable]);

  const saveSlots = useCallback(async (nextSlots) => {
    if (!runnable) {
      return;
    }

    setRuntime((current) => ({ ...current, loading: true, error: "" }));
    try {
      for (const slot of TRIGGER_SLOT_DEFINITIONS) {
        if (!Object.hasOwn(nextSlots, slot.key)) {
          continue;
        }

        await sendExternalTriggerCommand(
          sendScpiCommand,
          config.deviceName,
          interpolateSetupCommand(config.setupCommandTemplate, slot, nextSlots[slot.key]),
        );
      }
      await refreshRuntime();
    } catch (error) {
      setRuntime((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Trigger update failed.",
      }));
    }
  }, [config, refreshRuntime, runnable, sendScpiCommand]);

  return {
    runtime,
    refreshRuntime,
    saveSlots,
  };
}
