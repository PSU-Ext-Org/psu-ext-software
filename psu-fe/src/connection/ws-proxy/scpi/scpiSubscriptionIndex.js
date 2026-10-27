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
import { normalizeScpiQuery, validateScpiQuery } from "./scpiQueryValidation.js";

/**
 * Groups widget subscriptions by device/query and calculates their fastest rate.
 * Removing the final subscription notifies the scheduler to discard request/cache state.
 */
export function createScpiSubscriptionIndex(onIdentityRemoved) {
  const widgets = new Map();
  const groups = new Map();

  function add(subscription) {
    const normalized = normalizeSubscription(subscription);
    if (!normalized) {
      return null;
    }
    const previous = widgets.get(normalized.widgetId);
    if (previous && previous.identity !== normalized.identity) {
      removeFromGroup(previous);
    }
    widgets.set(normalized.widgetId, normalized);
    const subscriptions = new Map(groups.get(normalized.identity)?.subscriptions);
    subscriptions.set(normalized.widgetId, normalized);
    updateGroup(normalized.identity, subscriptions);
    return normalized;
  }

  function remove(subscription) {
    if (widgets.get(subscription.widgetId)?.identity !== subscription.identity) {
      return false;
    }
    widgets.delete(subscription.widgetId);
    removeFromGroup(subscription);
    return true;
  }

  function removeFromGroup(subscription) {
    const current = groups.get(subscription.identity);
    if (!current) {
      return;
    }
    const subscriptions = new Map(current.subscriptions);
    subscriptions.delete(subscription.widgetId);
    if (!subscriptions.size) {
      groups.delete(subscription.identity);
      onIdentityRemoved(subscription.identity);
      return;
    }
    updateGroup(subscription.identity, subscriptions);
  }

  function updateGroup(identity, subscriptions) {
    let fastestHz = 0;
    for (const subscription of subscriptions.values()) {
      fastestHz = Math.max(fastestHz, subscription.frequencyHz);
    }
    groups.set(identity, { subscriptions, fastestHz: fastestHz || 1 });
  }

  function getPrimary(identity) {
    return groups.get(identity)?.subscriptions.values().next().value || null;
  }

  function intervalMs(identity) {
    return Math.max(10, Math.round(1000 / (groups.get(identity)?.fastestHz || 1)));
  }

  function clear() {
    widgets.clear();
    groups.clear();
  }

  return {
    add,
    remove,
    getPrimary,
    intervalMs,
    identities: () => groups.keys(),
    has: (identity) => groups.has(identity),
    clear,
  };
}

/**
 * Produces the normalized cache/scheduling key shared by matching widget queries.
 * @param {unknown} deviceName
 * @param {unknown} query
 * @returns {string}
 */
export function createQueryIdentity(deviceName, query) {
  const normalizedDeviceName = String(deviceName || "").trim();
  const normalizedQuery = normalizeScpiQuery(query).toUpperCase();
  return normalizedDeviceName && normalizedQuery
    ? `${normalizedDeviceName}\u001f${normalizedQuery}`
    : "";
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
  return { widgetId, deviceName, query, frequencyHz, identity };
}
