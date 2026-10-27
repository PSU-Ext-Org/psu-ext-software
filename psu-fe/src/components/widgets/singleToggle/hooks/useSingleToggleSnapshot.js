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
import { useCallback, useRef, useSyncExternalStore } from "react";

/** Subscribes to one query and retains equivalent snapshot references across renders. */
export function useSingleToggleSnapshot({ deviceName, query, getScpiQuerySnapshot = emptySnapshot, subscribeScpiSnapshot = noopSubscribe }) {
  const lastSnapshotRef = useRef(null);
  const subscribe = useCallback(
    (listener) => subscribeScpiSnapshot(deviceName, query, listener),
    [deviceName, query, subscribeScpiSnapshot],
  );
  const getSnapshot = useCallback(() => {
    const next = getScpiQuerySnapshot(deviceName, query);
    const previous = lastSnapshotRef.current;
    if (previous && previous.value === next.value && previous.updatedAt === next.updatedAt
      && previous.loading === next.loading && previous.error === next.error) {
      return previous;
    }
    lastSnapshotRef.current = next;
    return next;
  }, [deviceName, query, getScpiQuerySnapshot]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function noopSubscribe() {
  return () => {};
}

function emptySnapshot() {
  return { value: "", updatedAt: 0, loading: false, error: "" };
}
