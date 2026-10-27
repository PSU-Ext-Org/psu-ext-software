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
import { createQueryIdentity, createScpiSubscriptionIndex } from "./scpiSubscriptionIndex.js";
import { createScpiSnapshotStore } from "./scpiSnapshotStore.js";
import { createScpiPollingController } from "./scpiPollingController.js";

export { createQueryIdentity } from "./scpiSubscriptionIndex.js";

/**
 * Composes shared polling, subscriptions and external snapshots behind a stable facade.
 *
 * @param {object} options
 * @param {(message: string, tag?: string) => string | null} options.sendWsMessage
 * @param {import("react").MutableRefObject<boolean>} options.wsConnectedRef
 * @param {() => {devices: object[], deviceByName?: Map<string, object>, deviceStatuses: object}} options.getDeviceState
 * @param {(deviceName: string, error: string) => boolean} [options.onScpiError]
 * @returns {{
 *   subscribeScpiQuery: (subscription: {widgetId: string, deviceName: string, query: string, frequencyHz: number}) => () => void,
 *   subscribeScpiSnapshot: (deviceName: string, query: string, listener: () => void) => () => void,
 *   getScpiQuerySnapshot: (deviceName: string, query: string) => object,
 *   handleScpiSchedulerMessage: (message: {uuid: string, payload: string}) => boolean,
 *   handleScpiSchedulerBinaryMessage: (message: {uuid: string, payload: string}) => boolean,
 *   pollScpiQueries: () => void,
 *   clearScpiScheduler: () => void
 * }}
 */
export function useScpiQueryScheduler({ sendWsMessage, wsConnectedRef, getDeviceState, onScpiError }) {
  const runtime = useRef({ sendWsMessage, wsConnectedRef, getDeviceState, onScpiError });
  const scheduler = useRef(null);
  if (!scheduler.current) {
    scheduler.current = createScheduler(() => runtime.current);
  }

  useEffect(() => scheduler.current.clearScpiScheduler, []);
  useEffect(() => {
    runtime.current = { sendWsMessage, wsConnectedRef, getDeviceState, onScpiError };
  }, [sendWsMessage, wsConnectedRef, getDeviceState, onScpiError]);

  return scheduler.current;
}

function createScheduler(getRuntime) {
  const snapshots = createScpiSnapshotStore();
  const subscriptions = createScpiSubscriptionIndex((identity) => {
    snapshots.remove(identity);
    polling.forgetIdentity(identity);
  });
  const polling = createScpiPollingController({ subscriptions, snapshots, getRuntime });

  function subscribeScpiQuery(subscription) {
    const normalized = subscriptions.add(subscription);
    if (!normalized) {
      return () => {};
    }
    polling.reconcile();
    return () => {
      if (subscriptions.remove(normalized)) {
        polling.reconcile();
      }
    };
  }

  function subscribeScpiSnapshot(deviceName, query, listener) {
    return snapshots.subscribe(createQueryIdentity(deviceName, query), listener);
  }

  function getScpiQuerySnapshot(deviceName, query) {
    return snapshots.get(createQueryIdentity(deviceName, query));
  }

  function clearScpiScheduler() {
    polling.clear();
    subscriptions.clear();
    snapshots.clear();
  }

  return {
    subscribeScpiQuery,
    subscribeScpiSnapshot,
    getScpiQuerySnapshot,
    handleScpiSchedulerMessage: polling.handleText,
    handleScpiSchedulerBinaryMessage: polling.handleBinary,
    pollScpiQueries: polling.pollAll,
    clearScpiScheduler,
  };
}
