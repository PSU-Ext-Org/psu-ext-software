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
import { INITIAL_RUNTIME_STATE } from "../utils/protectionHelpers.js";
import {
  emitTripEventIfNeeded,
  readFullRuntimeSnapshot,
  readTripStateSnapshot,
} from "../utils/protectionRuntime.js";

/** Owns read deduplication, trip polling, and notifications for one protection session. */
export function useProtectionReadings({
  config, placementId, runnable, sendScpiCommand, session, sessionKey, setRuntime,
}) {
  const fullRefreshPromiseRef = useRef(null);
  const pollPromiseRef = useRef(null);
  const lastTripStateRef = useRef("unknown");

  useEffect(() => {
    lastTripStateRef.current = "unknown";
    fullRefreshPromiseRef.current = null;
    pollPromiseRef.current = null;
    return () => {
      fullRefreshPromiseRef.current = null;
      pollPromiseRef.current = null;
    };
  }, [sessionKey]);

  const refreshRuntime = useCallback(async (source) => {
    if (!runnable) {
      return INITIAL_RUNTIME_STATE;
    }

    if (fullRefreshPromiseRef.current) {
      return fullRefreshPromiseRef.current;
    }

    const requestVersion = session.advance();
    setRuntime((current) => ({ ...current, loading: true, error: "" }));

    const nextRefresh = readFullRuntimeSnapshot(config, sendScpiCommand)
      .then((snapshot) => {
        if (!session.isCurrent(requestVersion)) {
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
        if (!session.isCurrent(requestVersion)) {
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
  }, [config, placementId, runnable, sendScpiCommand, session, setRuntime]);

  const pollTripState = useCallback(async () => {
    if (!runnable) {
      return INITIAL_RUNTIME_STATE;
    }

    if (pollPromiseRef.current || fullRefreshPromiseRef.current) {
      return pollPromiseRef.current || fullRefreshPromiseRef.current;
    }

    const requestVersion = session.capture();
    const nextPoll = readTripStateSnapshot(config, sendScpiCommand)
      .then((snapshot) => {
        if (!session.isCurrent(requestVersion)) {
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
        if (!session.isCurrent(requestVersion)) {
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
  }, [config, placementId, runnable, sendScpiCommand, session, setRuntime]);

  useEffect(() => {
    if (!runnable) {
      return undefined;
    }

    void refreshRuntime("mount").catch(() => {});
    const intervalId = window.setInterval(() => {
      void pollTripState().catch(() => {});
    }, Math.max(10, Math.round(1000 / config.frequencyHz)));

    return () => window.clearInterval(intervalId);
  }, [config.frequencyHz, pollTripState, refreshRuntime, runnable]);

  return refreshRuntime;
}
