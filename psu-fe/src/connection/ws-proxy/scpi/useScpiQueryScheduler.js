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
import { MONITOR_TAG } from "../monitor/monitorTagQueue.js";
import { parseScpiMeasurementDataBlock } from "./scpiBinaryData.js";
import { normalizeScpiQuery, validateScpiQuery } from "./scpiQueryValidation.js";
import { decodeBase64Payload } from "../ws/wsEnvelope.js";

const DEFAULT_SNAPSHOT = Object.freeze({
  value: "",
  points: [],
  updatedAt: 0,
  loading: false,
  error: "",
});

/**
 * Owns shared SCPI query polling and latest-value cache.
 *
 * @param {object} options
 * @param {(message: string, tag?: string) => boolean} options.sendWsMessage
 * @param {import("react").MutableRefObject<boolean>} options.wsConnectedRef
 * @param {() => {devices: Array<{name: string, id: string}>, deviceByName?: Map<string, {name: string, id: string}>, deviceStatuses: Record<string, {state?: string}>}} options.getDeviceState
 * @returns {{
 *   subscribeScpiQuery: (subscription: {widgetId: string, deviceName: string, query: string, frequencyHz: number}) => () => void,
 *   subscribeScpiSnapshot: (deviceName: string, query: string, listener: () => void) => () => void,
 *   getScpiQuerySnapshot: (deviceName: string, query: string) => typeof DEFAULT_SNAPSHOT,
 *   handleScpiSchedulerMessage: (message: {uuid: string, payload: string}) => boolean,
 *   handleScpiSchedulerBinaryMessage: (message: {uuid: string, payload: string}) => boolean,
 *   pollScpiQueries: () => void,
 *   clearScpiScheduler: () => void
 * }}
 */
export function useScpiQueryScheduler({ sendWsMessage, wsConnectedRef, getDeviceState }) {
  const subscriptionsRef = useRef(new Map());
  const identitySubscriptionsRef = useRef(new Map());
  const timersRef = useRef(new Map());
  const cacheRef = useRef(new Map());
  const snapshotListenersRef = useRef(new Map());
  const pendingByUuidRef = useRef(new Map());
  const pendingIdentitySetRef = useRef(new Set());
  const sendWsMessageRef = useRef(sendWsMessage);
  const getDeviceStateRef = useRef(getDeviceState);

  useEffect(() => clearScpiScheduler, []);

  useEffect(() => {
    sendWsMessageRef.current = sendWsMessage;
    getDeviceStateRef.current = getDeviceState;
  }, [getDeviceState, sendWsMessage]);

  const subscribeScpiQuery = useCallback((subscription) => {
    const normalized = normalizeSubscription(subscription);
    if (!normalized) {
      return () => {};
    }

    const previous = subscriptionsRef.current.get(normalized.widgetId);
    if (previous && previous.identity !== normalized.identity) {
      removeIdentitySubscription(previous);
    }

    subscriptionsRef.current.set(normalized.widgetId, normalized);
    addIdentitySubscription(normalized);
    reconcileSchedules();

    return () => {
      const current = subscriptionsRef.current.get(normalized.widgetId);
      if (current?.identity !== normalized.identity) {
        return;
      }

      subscriptionsRef.current.delete(normalized.widgetId);
      removeIdentitySubscription(normalized);
      reconcileSchedules();
    };
  }, []);

  const subscribeScpiSnapshot = useCallback((deviceName, query, listener) => {
    const identity = createQueryIdentity(deviceName, query);
    if (!identity || typeof listener !== "function") {
      return () => {};
    }

    const listeners = snapshotListenersRef.current.get(identity) || new Set();
    listeners.add(listener);
    snapshotListenersRef.current.set(identity, listeners);

    return () => {
      const currentListeners = snapshotListenersRef.current.get(identity);
      if (!currentListeners) {
        return;
      }

      currentListeners.delete(listener);
      if (!currentListeners.size) {
        snapshotListenersRef.current.delete(identity);
      }
    };
  }, []);

  const getScpiQuerySnapshot = useCallback((deviceName, query) => {
    const identity = createQueryIdentity(deviceName, query);
    return identity ? cacheRef.current.get(identity) || DEFAULT_SNAPSHOT : DEFAULT_SNAPSHOT;
  }, []);

  const handleScpiSchedulerMessage = useCallback((message) => {
    const pending = pendingByUuidRef.current.get(message.uuid);
    if (!pending) {
      return false;
    }

    pendingByUuidRef.current.delete(message.uuid);
    pendingIdentitySetRef.current.delete(pending.identity);
    const isError = message.payload.startsWith("ERR ");
    const previous = cacheRef.current.get(pending.identity) || DEFAULT_SNAPSHOT;
    setSnapshot(pending.identity, {
      ...previous,
      value: isError ? previous.value : String(message.payload).trim(),
      points: [],
      updatedAt: Date.now(),
      loading: false,
      error: isError ? message.payload : "",
    });
    return true;
  }, []);

  const handleScpiSchedulerBinaryMessage = useCallback((message) => {
    const pending = pendingByUuidRef.current.get(message.uuid);
    if (!pending) {
      return false;
    }

    pendingByUuidRef.current.delete(message.uuid);
    pendingIdentitySetRef.current.delete(pending.identity);
    const receivedAt = Date.now();
    const previous = cacheRef.current.get(pending.identity) || DEFAULT_SNAPSHOT;
    const points = parseScpiMeasurementDataBlock(decodeBase64Payload(message.payload), receivedAt);
    setSnapshot(pending.identity, {
      ...previous,
      value: points.length ? String(points.at(-1).y) : previous.value,
      points,
      updatedAt: receivedAt,
      loading: false,
      error: points.length ? "" : "Empty or invalid binary DATA response.",
    });
    return true;
  }, []);

  const pollScpiQueries = useCallback(() => {
    for (const identity of identitySubscriptionsRef.current.keys()) {
      pollIdentity(identity);
    }
  }, []);

  const clearScpiScheduler = useCallback(() => {
    for (const timer of timersRef.current.values()) {
      window.clearInterval(timer.id);
    }

    subscriptionsRef.current.clear();
    identitySubscriptionsRef.current.clear();
    timersRef.current.clear();
    cacheRef.current.clear();
    pendingByUuidRef.current.clear();
    pendingIdentitySetRef.current.clear();
  }, []);

  function reconcileSchedules() {
    const activeIdentities = identitySubscriptionsRef.current;

    for (const [identity, timer] of timersRef.current.entries()) {
      if (!activeIdentities.has(identity)) {
        window.clearInterval(timer.id);
        timersRef.current.delete(identity);
      }
    }

    for (const identity of activeIdentities.keys()) {
      const nextIntervalMs = getFastestIntervalMs(identity);
      const currentTimer = timersRef.current.get(identity);

      if (currentTimer?.intervalMs === nextIntervalMs) {
        continue;
      }

      if (currentTimer) {
        window.clearInterval(currentTimer.id);
      }

      pollIdentity(identity);
      timersRef.current.set(identity, {
        id: window.setInterval(() => pollIdentity(identity), nextIntervalMs),
        intervalMs: nextIntervalMs,
      });
    }
  }

  function pollIdentity(identity) {
    const subscription = getPrimarySubscription(identity);
    if (!subscription || !canPoll(subscription)) {
      return;
    }

    if (pendingIdentitySetRef.current.has(identity)) {
      return;
    }

    const previous = cacheRef.current.get(identity) || DEFAULT_SNAPSHOT;
    setSnapshot(identity, { ...previous, loading: true, error: "" });
    const uuid = sendWsMessageRef.current(
      `CMD ${subscription.deviceName} ${subscription.query}`,
      MONITOR_TAG.SCHEDULER,
    );
    if (!uuid) {
      setSnapshot(identity, {
        ...previous,
        loading: false,
        error: "SCPI query could not be sent.",
      });
      return;
    }

    pendingByUuidRef.current.set(uuid, { identity });
    pendingIdentitySetRef.current.add(identity);
  }

  function canPoll(subscription) {
    if (!wsConnectedRef.current) {
      return false;
    }

    const { devices, deviceByName, deviceStatuses } = getDeviceStateRef.current();
    const device =
      deviceByName?.get(subscription.deviceName) ||
      devices.find((candidate) => candidate.name === subscription.deviceName);
    return Boolean(device && deviceStatuses[device.id]?.state === "CONNECTED");
  }

  function getFastestIntervalMs(identity) {
    const identitySubscriptions = identitySubscriptionsRef.current.get(identity);
    const fastestHz = identitySubscriptions?.fastestHz || 1;

    return Math.max(10, Math.round(1000 / fastestHz));
  }

  function addIdentitySubscription(subscription) {
    const current = identitySubscriptionsRef.current.get(subscription.identity);
    const subscriptions = new Map(current?.subscriptions);
    subscriptions.set(subscription.widgetId, subscription);
    identitySubscriptionsRef.current.set(subscription.identity, {
      subscriptions,
      fastestHz: getFastestFrequency(subscriptions),
    });
  }

  function removeIdentitySubscription(subscription) {
    const current = identitySubscriptionsRef.current.get(subscription.identity);
    if (!current) {
      return;
    }

    const subscriptions = new Map(current.subscriptions);
    subscriptions.delete(subscription.widgetId);
    if (!subscriptions.size) {
      identitySubscriptionsRef.current.delete(subscription.identity);
      cacheRef.current.delete(subscription.identity);
      removePendingIdentity(subscription.identity);
      pendingIdentitySetRef.current.delete(subscription.identity);
      return;
    }

    identitySubscriptionsRef.current.set(subscription.identity, {
      subscriptions,
      fastestHz: getFastestFrequency(subscriptions),
    });
  }

  function getPrimarySubscription(identity) {
    const identitySubscriptions = identitySubscriptionsRef.current.get(identity);
    return identitySubscriptions?.subscriptions.values().next().value || null;
  }

  function getFastestFrequency(subscriptions) {
    let fastestHz = 0;
    for (const subscription of subscriptions.values()) {
      fastestHz = Math.max(fastestHz, subscription.frequencyHz);
    }

    return fastestHz || 1;
  }

  function setSnapshot(identity, snapshot) {
    const previous = cacheRef.current.get(identity) || DEFAULT_SNAPSHOT;
    if (snapshotsEqual(previous, snapshot)) {
      return;
    }

    cacheRef.current.set(identity, snapshot);
    notifySnapshotListeners(identity);
  }

  function notifySnapshotListeners(identity) {
    const listeners = snapshotListenersRef.current.get(identity);
    if (!listeners) {
      return;
    }

    for (const listener of listeners) {
      listener();
    }
  }

  function removePendingIdentity(identity) {
    for (const [uuid, pending] of pendingByUuidRef.current.entries()) {
      if (pending.identity === identity) {
        pendingByUuidRef.current.delete(uuid);
      }
    }
  }

  return {
    subscribeScpiQuery,
    subscribeScpiSnapshot,
    getScpiQuerySnapshot,
    handleScpiSchedulerMessage,
    handleScpiSchedulerBinaryMessage,
    pollScpiQueries,
    clearScpiScheduler,
  };
}

function snapshotsEqual(first, second) {
  return (
    first.value === second.value &&
    first.points === second.points &&
    first.updatedAt === second.updatedAt &&
    first.loading === second.loading &&
    first.error === second.error
  );
}

/**
 * @param {unknown} deviceName
 * @param {unknown} query
 * @returns {string}
 */
export function createQueryIdentity(deviceName, query) {
  const normalizedDeviceName = String(deviceName || "").trim();
  const normalizedQuery = normalizeScpiQuery(query).toUpperCase();

  return normalizedDeviceName && normalizedQuery ? `${normalizedDeviceName}\u001f${normalizedQuery}` : "";
}

function normalizeSubscription(subscription) {
  const widgetId = String(subscription.widgetId || "").trim();
  const deviceName = String(subscription.deviceName || "").trim();
  const query = normalizeScpiQuery(subscription.query);
  const frequencyHz = Math.min(Math.max(Number(subscription.frequencyHz) || 1, 0.1), 100);
  const identity = createQueryIdentity(deviceName, query);

  if (!widgetId || !deviceName || validateScpiQuery(query) || !identity) {
    return null;
  }

  return {
    widgetId,
    deviceName,
    query,
    frequencyHz,
    identity,
  };
}
