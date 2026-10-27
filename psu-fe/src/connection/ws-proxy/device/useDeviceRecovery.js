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
import { useEffect, useRef } from "react";
import { getRecoveryDelay, isRecovering } from "./deviceRecoveryPolicy.js";

/**
 * Owns recovery eligibility, manual suppression, attempt counts and retry timers.
 * Successful connections reset the budget; manual disconnect revokes eligibility.
 */
export function useDeviceRecovery({ wsConnected, statuses, getStatus, retry }) {
  const eligibleIds = useRef(new Set());
  const attempts = useRef(new Map());
  const timers = useRef(new Map());
  const manualIds = useRef(new Set());
  const latest = useRef({ getStatus, retry });
  latest.current = { getStatus, retry };

  useEffect(() => {
    for (const id of timers.current.keys()) {
      if (!wsConnected || !statuses[id]?.reconnecting || statuses[id]?.state !== "DISCONNECTED") {
        clearTimer(id);
      }
    }
    if (!wsConnected) {
      return;
    }
    for (const [id, status] of Object.entries(statuses)) {
      if (!status.reconnecting || status.state !== "DISCONNECTED" || timers.current.has(id)) {
        continue;
      }
      const delay = getRecoveryDelay(attempts.current.get(id));
      if (delay !== null) {
        timers.current.set(id, window.setTimeout(() => retryDevice(id), delay));
      }
    }
  }, [wsConnected, statuses]);

  useEffect(() => reset, []);

  function retryDevice(id) {
    timers.current.delete(id);
    if (!eligibleIds.current.has(id) || latest.current.getStatus(id)?.state !== "DISCONNECTED") {
      return;
    }
    attempts.current.set(id, (attempts.current.get(id) || 0) + 1);
    latest.current.retry(id);
  }

  function clearTimer(id) {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }

  function recordState(id, state) {
    const key = String(id);
    if (state === "CONNECTED" && !manualIds.current.has(key)) {
      eligibleIds.current.add(key);
      attempts.current.delete(key);
    }
    if (state === "DISCONNECTED" && getRecoveryDelay(attempts.current.get(key)) === null) {
      eligibleIds.current.delete(key);
    }
    return isRecovering(eligibleIds.current.has(key), state);
  }

  function allowConnect(id) {
    manualIds.current.delete(String(id));
  }

  function suppress(id) {
    const key = String(id);
    eligibleIds.current.delete(key);
    attempts.current.delete(key);
    manualIds.current.add(key);
    clearTimer(key);
  }

  function isSuppressed(id) {
    return manualIds.current.has(String(id));
  }

  function reset() {
    for (const id of timers.current.keys()) {
      clearTimer(id);
    }
    eligibleIds.current.clear();
    attempts.current.clear();
    manualIds.current.clear();
  }

  return { recordState, allowConnect, suppress, isSuppressed, reset };
}
