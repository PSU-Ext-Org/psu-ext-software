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

/**
 * Owns polling intervals and pending scheduler UUIDs. Dependencies supply current
 * transport/device state; subscription and snapshot ownership remains separate.
 */
export function createScpiPollingController({ subscriptions, snapshots, getRuntime }) {
  const timers = new Map();
  const pendingByUuid = new Map();
  const pendingIdentities = new Set();

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

  function pollAll() {
    for (const identity of subscriptions.identities()) {
      pollIdentity(identity);
    }
  }

  function pollIdentity(identity) {
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
      return;
    }
    const previous = snapshots.get(identity);
    snapshots.set(identity, { ...previous, disconnected: false, loading: true, error: "" });
    const uuid = getRuntime().sendWsMessage(
      `CMD ${subscription.deviceName} ${subscription.query}`,
      MONITOR_TAG.SCHEDULER,
    );
    if (!uuid) {
      snapshots.set(identity, { ...previous, loading: false, error: "SCPI query could not be sent." });
      return;
    }
    pendingByUuid.set(uuid, { identity, deviceName: subscription.deviceName });
    pendingIdentities.add(identity);
  }

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

  function takePending(uuid) {
    const pending = pendingByUuid.get(uuid);
    if (pending) {
      pendingByUuid.delete(uuid);
      pendingIdentities.delete(pending.identity);
    }
    return pending;
  }

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

  function invalidateDevice(deviceName) {
    for (const identity of subscriptions.identities()) {
      if (subscriptions.getPrimary(identity)?.deviceName === deviceName) {
        forgetIdentity(identity);
        snapshots.set(identity, DISCONNECTED_SCPI_SNAPSHOT);
      }
    }
  }

  function forgetIdentity(identity) {
    for (const [uuid, pending] of pendingByUuid) {
      if (pending.identity === identity) {
        pendingByUuid.delete(uuid);
      }
    }
    pendingIdentities.delete(identity);
  }

  function clear() {
    for (const timer of timers.values()) {
      window.clearInterval(timer.id);
    }
    timers.clear();
    pendingByUuid.clear();
    pendingIdentities.clear();
  }

  return { reconcile, pollAll, handleText, handleBinary, forgetIdentity, clear };
}
