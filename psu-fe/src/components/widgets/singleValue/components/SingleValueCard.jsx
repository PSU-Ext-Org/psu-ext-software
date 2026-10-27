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
import { useMemo } from "react";
import { useWebSocketConnection } from "../../../../connection/ws-proxy/WebSocketConnectionContext.jsx";
import { DEFAULT_SINGLE_VALUE_CONFIG, useSingleValueConfig } from "../singleValueConfig.js";
import { useSingleValueSnapshot } from "../hooks/useSingleValueSnapshot.js";
import { getStatusText, validateRunnableConfig } from "../utils/singleValuePresentation.js";
import { SingleValueSettingsButton } from "./SingleValueSettingsButton.jsx";

/**
 * Dynamic dashboard title for a persisted SingleValueCard instance.
 *
 * @param {{placement: {id: string}}} props
 * @returns {import("react").ReactElement}
 */
export function SingleValueCardTitle({ placement }) {
  const [config] = useSingleValueConfig(placement.id);

  return <>{config.cardName || DEFAULT_SINGLE_VALUE_CONFIG.cardName}</>;
}

/**
 * Header action for configuring a persisted SingleValueCard instance.
 *
 * @param {{placement: {id: string}}} props
 * @returns {import("react").ReactElement}
 */
export function SingleValueCardActions({ placement }) {
  return <SingleValueSettingsButton iconOnly placement={placement} />;
}

/**
 * 1x1 dashboard widget that displays one cached SCPI query value.
 *
 * @param {{placement: {id: string}}} props
 * @returns {import("react").ReactElement}
 */
export function SingleValueCard({ placement }) {
  const {
    getScpiQuerySnapshot,
    subscribeScpiSnapshot,
    wsConnected,
    devices = [],
    deviceStatuses = {},
  } = useWebSocketConnection();
  const [config] = useSingleValueConfig(placement.id);
  const snapshot = useSingleValueSnapshot({
    deviceName: config.deviceName,
    query: config.query,
    getScpiQuerySnapshot,
    subscribeScpiSnapshot,
  });
  const deviceByName = useMemo(
    () => new Map(devices.map((candidate) => [candidate.name, candidate])),
    [devices],
  );
  const validationError = validateRunnableConfig(config);
  const device = deviceByName.get(config.deviceName);
  const deviceConnected = Boolean(device && deviceStatuses[device.id]?.state === "CONNECTED");
  const statusText = getStatusText({ config, device, deviceConnected, snapshot, validationError, wsConnected });

  if (!config.deviceName || !config.query) {
    return (
      <div className="flex min-h-full flex-col gap-3">
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Configure a target device and SCPI query.
        </p>
        <div className="mt-auto">
          <SingleValueSettingsButton placement={placement} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-3">
      <div className="min-w-0 rounded-md bg-slate-100 px-3 py-3">
        <p
          className="truncate text-3xl font-semibold leading-tight"
          data-testid={`single-value-${placement.id}`}
          style={{ color: config.valueColor }}
        >
          {wsConnected && deviceConnected ? snapshot.value || "--" : "--"}
        </p>
        <p className="mt-1 truncate text-sm font-medium text-slate-600">{config.unit || "\u00a0"}</p>
      </div>
      <div className="mt-auto grid gap-1 text-xs text-slate-600">
        <div className="flex min-w-0 justify-between gap-3">
          <span className="shrink-0">Target</span>
          <strong className="min-w-0 truncate text-right">{config.deviceName}</strong>
        </div>
        <div className="flex min-w-0 justify-between gap-3">
          <span className="shrink-0">Status</span>
          <strong className="min-w-0 truncate text-right">{statusText}</strong>
        </div>
      </div>
    </div>
  );
}
