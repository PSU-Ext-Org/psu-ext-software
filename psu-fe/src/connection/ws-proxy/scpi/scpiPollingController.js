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
import { MONITOR_TAG } from "../monitor/monitorTagQueue.js";
import { decodeBase64Payload } from "../ws/wsEnvelope.js";
import { parseScpiMeasurementDataBlock } from "./scpiBinaryData.js";
import { DISCONNECTED_SCPI_SNAPSHOT } from "./scpiSnapshotStore.js";

const REFRESH_TIMEOUT_MS = 10_000;

/**
 * Owns polling intervals and pending scheduler UUIDs. Dependencies supply current
 * transport/device state; subscription and snapshot ownership remains separate.
 *
 * @param {object} options
 * @param {ReturnType<typeof import("./scpiSubscriptionIndex.js").createScpiSubscriptionIndex>} options.subscriptions
 * @param {ReturnType<typeof import("./scpiSnapshotStore.js").createScpiSnapshotStore>} options.snapshots
 * @param {() => object} options.getRuntime - Current transport, connection, and error handlers.
 * @returns {{
 *   reconcile: () => void,
 *   pollAll: () => void,
 *   refresh: (identity: string) => boolean,
 *   handleText: (message: {uuid: string, payload: string}) => boolean,
 *   handleBinary: (message: {uuid: string, payload: string}) => boolean,
 *   forgetIdentity: (identity: string) => void,
 *   clear: () => void
 * }}
 */
export function createScpiPollingController({ subscriptions, snapshots, getRuntime }) {
  const timers = new Map();
  const pendingByUuid = new Map();
  const pendingIdentities = new Set();

  /** Aligns polling intervals with the currently registered subscriptions. */
  function reconcile() {
    for (const [identity, timer] of timers) {
      if (!subscriptions.has(identity)) {
        window.clearInterval(timer.id);
        timers.delete(identity);
      }
    }

    for (const identity of subscriptions.identities()) {
      const intervalMs = subscriptions.intervalMs(identity);
      const previous = timers.get(identity);

      if (previous?.intervalMs === intervalMs) {
        continue;
      }

      if (previous) {
        window.clearInterval(previous.id);
      }

      pollIdentity(identity);
      timers.set(identity, {
        id: window.setInterval(() => pollIdentity(identity), intervalMs),
        intervalMs,
      });
    }
  }

  /** Retries registered measurements after a transport or device state change. */
  function pollAll() {
    for (const identity of subscriptions.identities()) {
      pollIdentity(identity);
    }
  }

  /**
   * Sends at most one owned request per measurement identity.
   *
   * @param {string} identity - Normalized device/query subscription key.
   * @param {boolean} [refresh=false] - Explicit refreshes get a bounded wait for feedback.
   * @returns {boolean | undefined} True only when a new request was sent.
   */
  function pollIdentity(identity, refresh = false) {
    const subscription = subscriptions.getPrimary(identity);

    if (!subscription) {
      return;
    }

    if (!canPoll(subscription)) {
      forgetIdentity(identity);
      snapshots.set(identity, DISCONNECTED_SCPI_SNAPSHOT);
      return;
    }

    if (pendingIdentities.has(identity)) {
      return false;
    }

    const previous = snapshots.get(identity);

    // Retain the last measurement while the new request is in flight.
    snapshots.set(identity, {
      ...previous,
      disconnected: false,
      loading: true,
      error: "",
    });

    const uuid = getRuntime().sendWsMessage(
      `CMD ${subscription.deviceName} ${subscription.query}`,
      MONITOR_TAG.SCHEDULER,
    );

    if (!uuid) {
      snapshots.set(identity, {
        ...previous,
        loading: false,
        error: "SCPI query could not be sent.",
      });

      return false;
    }

    const timeoutId = refresh ? startRefreshTimeout(uuid, identity) : null;
    pendingByUuid.set(uuid, {
      identity,
      deviceName: subscription.deviceName,
      timeoutId,
    });
    pendingIdentities.add(identity);

    return true;
  }

  /**
   * Supersedes a pending measurement and sends a new one immediately.
   *
   * @param {string} identity - Existing subscription key.
   * @returns {boolean} Whether a fresh request was sent.
   */
  function refresh(identity) {
    // Remove ownership first so a pre-write reply cannot overwrite the refresh.
    forgetIdentity(identity);
    return Boolean(pollIdentity(identity, true));
  }

  /**
   * Bounds explicit refresh feedback without changing normal polling intervals.
   *
   * @param {string} uuid - Request whose ownership is released on timeout.
   * @param {string} identity - Snapshot to mark as failed if no reply arrives.
   * @returns {number} Browser timeout handle, cleared when the request is consumed.
   */
  function startRefreshTimeout(uuid, identity) {
    return window.setTimeout(() => {
      if (!takePending(uuid)) {
        return;
      }

      snapshots.set(identity, {
        ...snapshots.get(identity),
        loading: false,
        error: "SCPI refresh timed out.",
      });
    }, REFRESH_TIMEOUT_MS);
  }

  /** Requires both the browser-to-proxy and proxy-to-device connections. */
  function canPoll(subscription) {
    const runtime = getRuntime();

    if (!runtime.wsConnectedRef.current) {
      return false;
    }

    const { devices, deviceByName, deviceStatuses } = runtime.getDeviceState();
    const device = deviceByName?.get(subscription.deviceName)
      || devices.find((candidate) => candidate.name === subscription.deviceName);

    return Boolean(device && deviceStatuses[device.id]?.state === "CONNECTED");
  }

  /** Releases request ownership and its timeout exactly once. */
  function takePending(uuid) {
    const pending = pendingByUuid.get(uuid);

    if (pending) {
      window.clearTimeout(pending.timeoutId);
      pendingByUuid.delete(uuid);
      pendingIdentities.delete(pending.identity);
    }

    return pending;
  }

  /** Applies a correlated text response, retaining the last value on device errors. */
  function handleText(message) {
    const pending = takePending(message.uuid);

    if (!pending) {
      return false;
    }

    const payload = String(message.payload).trim();
    const isError = payload.startsWith("ERR ");

    if (isError && getRuntime().onScpiError?.(pending.deviceName, payload)) {
      invalidateDevice(pending.deviceName);
      return true;
    }

    const previous = snapshots.get(pending.identity);
    snapshots.set(pending.identity, {
      ...previous,
      value: isError ? previous.value : payload,
      points: [],
      updatedAt: Date.now(),
      loading: false,
      error: isError ? message.payload : "",
    });

    return true;
  }

  /** Applies a correlated binary measurement through the same shared snapshot. */
  function handleBinary(message) {
    const pending = takePending(message.uuid);

    if (!pending) {
      return false;
    }

    const receivedAt = Date.now();
    const previous = snapshots.get(pending.identity);
    const points = parseScpiMeasurementDataBlock(decodeBase64Payload(message.payload), receivedAt);
    snapshots.set(pending.identity, {
      ...previous,
      value: points.length ? String(points.at(-1).y) : previous.value,
      points,
      updatedAt: receivedAt,
      loading: false,
      error: points.length ? "" : "Empty or invalid binary DATA response.",
    });

    return true;
  }

  /** Clears every measurement belonging to a device that became unavailable. */
  function invalidateDevice(deviceName) {
    for (const identity of subscriptions.identities()) {
      if (subscriptions.getPrimary(identity)?.deviceName === deviceName) {
        forgetIdentity(identity);
        snapshots.set(identity, DISCONNECTED_SCPI_SNAPSHOT);
      }
    }
  }

  /** Forgets pending replies and timers when refreshing, disconnecting, or unsubscribing. */
  function forgetIdentity(identity) {
    for (const [uuid, pending] of pendingByUuid) {
      if (pending.identity === identity) {
        window.clearTimeout(pending.timeoutId);
        pendingByUuid.delete(uuid);
      }
    }

    pendingIdentities.delete(identity);
  }

  /** Releases intervals and refresh timeouts when the scheduler is disposed. */
  function clear() {
    for (const timer of timers.values()) {
      window.clearInterval(timer.id);
    }

    timers.clear();

    for (const pending of pendingByUuid.values()) {
      window.clearTimeout(pending.timeoutId);
    }

    pendingByUuid.clear();
    pendingIdentities.clear();
  }

  return {
    reconcile,
    pollAll,
    refresh,
    handleText,
    handleBinary,
    forgetIdentity,
    clear,
  };
}
