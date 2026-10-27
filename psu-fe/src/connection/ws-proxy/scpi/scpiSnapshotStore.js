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
export const DEFAULT_SCPI_SNAPSHOT = Object.freeze({
  disconnected: false,
  value: "",
  points: [],
  updatedAt: 0,
  loading: false,
  error: "",
});
export const DISCONNECTED_SCPI_SNAPSHOT = Object.freeze({
  ...DEFAULT_SCPI_SNAPSHOT,
  disconnected: true,
});

/**
 * Stores immutable snapshots outside React and notifies only the changed identity.
 * Equal writes retain their previous reference for useSyncExternalStore consumers.
 */
export function createScpiSnapshotStore() {
  const cache = new Map();
  const listeners = new Map();

  function get(identity) {
    return cache.get(identity) || DEFAULT_SCPI_SNAPSHOT;
  }

  function set(identity, snapshot) {
    if (snapshotsEqual(get(identity), snapshot)) {
      return;
    }
    cache.set(identity, snapshot);
    for (const listener of listeners.get(identity) || []) {
      listener();
    }
  }

  function subscribe(identity, listener) {
    if (!identity || typeof listener !== "function") {
      return () => {};
    }
    const subscribers = listeners.get(identity) || new Set();
    subscribers.add(listener);
    listeners.set(identity, subscribers);
    return () => {
      const current = listeners.get(identity);
      current?.delete(listener);
      if (current && !current.size) {
        listeners.delete(identity);
      }
    };
  }

  // Clearing the public scheduler has always preserved snapshot subscriptions.
  // Owners release those subscriptions through the returned unsubscribe functions.
  function clear() {
    cache.clear();
  }

  return { get, set, subscribe, remove: (identity) => cache.delete(identity), clear };
}

function snapshotsEqual(first, second) {
  return first.disconnected === second.disconnected
    && first.value === second.value
    && first.points === second.points
    && first.updatedAt === second.updatedAt
    && first.loading === second.loading
    && first.error === second.error;
}
