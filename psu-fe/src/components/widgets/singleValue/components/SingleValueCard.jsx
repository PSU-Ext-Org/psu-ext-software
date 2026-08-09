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
import { Settings } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useModalDialog } from "../../../layout/hooks/useModalDialog.js";
import { useWebSocketConnection } from "../../../../connection/ws-proxy/WebSocketConnectionContext.jsx";
import { connectedDevices } from "../../../../connection/ws-proxy/device/deviceRegistry.js";
import { normalizeScpiQuery, validateScpiQuery } from "../../../../connection/ws-proxy/scpi/scpiQueryValidation.js";
import {
  DEFAULT_SINGLE_VALUE_CONFIG,
  normalizeFrequency,
  saveSingleValueConfig,
  useSingleValueConfig,
} from "../singleValueConfig.js";

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
    subscribeScpiSnapshot = noopSubscribe,
    wsConnected,
    devices = [],
    deviceStatuses = {},
  } = useWebSocketConnection();
  const [config] = useSingleValueConfig(placement.id);
  const subscribeSnapshot = useCallback(
    (listener) => subscribeScpiSnapshot(config.deviceName, config.query, listener),
    [config.deviceName, config.query, subscribeScpiSnapshot],
  );
  const lastSnapshotRef = useRef(null);
  const getSnapshot = useCallback(
    () => {
      const nextSnapshot = getScpiQuerySnapshot(config.deviceName, config.query);
      if (lastSnapshotRef.current && snapshotsEqual(lastSnapshotRef.current, nextSnapshot)) {
        return lastSnapshotRef.current;
      }

      lastSnapshotRef.current = nextSnapshot;
      return nextSnapshot;
    },
    [config.deviceName, config.query, getScpiQuerySnapshot],
  );
  const snapshot = useSyncExternalStore(subscribeSnapshot, getSnapshot, getSnapshot);
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
          {snapshot.value || "--"}
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

function SingleValueSettingsButton({ iconOnly = false, placement }) {
  const { devices = [], deviceStatuses = {} } = useWebSocketConnection();
  const [config, setConfig] = useSingleValueConfig(placement.id);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(config);
  const dialogRef = useModalDialog(open, () => setOpen(false));
  const connectedTargets = useMemo(
    () => connectedDevices(devices, deviceStatuses),
    [devices, deviceStatuses],
  );
  const deviceOptions = useMemo(
    () => (devices.length ? devices : connectedTargets),
    [connectedTargets, devices],
  );
  const errors = useMemo(() => validateDraft(draft), [draft]);

  useEffect(() => {
    if (!open) {
      setDraft(config);
    }
  }, [config, open]);

  return (
    <>
      <button
        aria-label={iconOnly ? "Configure single value card" : undefined}
        className={
          iconOnly
            ? "inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
            : "control-standard inline-flex w-full items-center justify-center gap-2 bg-teal-700 font-medium text-white hover:bg-teal-800"
        }
        onClick={() => setOpen(true)}
        onPointerDown={(event) => event.stopPropagation()}
        type="button"
      >
        <Settings className="h-4 w-4" />
        {iconOnly ? <span className="sr-only">Configure</span> : "Configure"}
      </button>

      {open ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6"
          onPointerDown={(event) => event.stopPropagation()}
          role="dialog"
          ref={dialogRef}
        >
          <form
            className="grid w-full max-w-lg gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              if (errors.length) {
                return;
              }

              setConfig(saveSingleValueConfig(placement.id, draft));
              setOpen(false);
            }}
          >
            <div className="flex min-w-0 items-start justify-between gap-4">
              <h3 className="text-lg font-semibold text-slate-950">Single Value Settings</h3>
              <button
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Device
              <select
                className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                onChange={(event) => updateDraft("deviceName", event.target.value)}
                value={draft.deviceName}
              >
                <option value="">Select device</option>
                {deviceOptions.map((device) => (
                  <option key={device.id} value={device.name}>
                    {device.id} / {device.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              SCPI query
              <input
                className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                onChange={(event) => updateDraft("query", event.target.value)}
                placeholder="MEAS:VOLT? CH1"
                value={draft.query}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Frequency (Hz)
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  max="100"
                  min="0.1"
                  onChange={(event) => updateDraft("frequencyHz", event.target.value)}
                  step="0.1"
                  type="number"
                  value={draft.frequencyHz}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Unit
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  onChange={(event) => updateDraft("unit", event.target.value)}
                  placeholder="V"
                  value={draft.unit}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem]">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Card name
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  onChange={(event) => updateDraft("cardName", event.target.value)}
                  placeholder="Voltage"
                  value={draft.cardName}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Color
                <input
                  className="h-8 w-full rounded-md border border-slate-300 bg-white p-1"
                  onChange={(event) => updateDraft("valueColor", event.target.value)}
                  type="color"
                  value={draft.valueColor}
                />
              </label>
            </div>

            {errors.length ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {errors[0]}
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <button
                className="control-standard border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="control-standard bg-teal-700 font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                disabled={errors.length > 0}
                type="submit"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );

  function updateDraft(key, value) {
    setDraft((current) => ({
      ...current,
      [key]: key === "query" ? value : value,
    }));
  }
}

function validateDraft(draft) {
  const errors = [];
  const frequency = normalizeFrequency(draft.frequencyHz);
  const queryError = validateScpiQuery(draft.query);

  if (!String(draft.deviceName || "").trim()) {
    errors.push("Select a target device.");
  }

  if (queryError) {
    errors.push(queryError);
  }

  if (Number.parseFloat(draft.frequencyHz) !== frequency) {
    errors.push("Frequency must be between 0.1 Hz and 100 Hz.");
  }

  return errors;
}

function validateRunnableConfig(config) {
  if (!config.deviceName || !config.query) {
    return "Configure this card.";
  }

  return validateScpiQuery(config.query);
}

function getStatusText({ config, device, deviceConnected, snapshot, validationError, wsConnected }) {
  if (validationError) {
    return validationError;
  }

  if (!wsConnected) {
    return "WebSocket offline";
  }

  if (!device) {
    return "Device unavailable";
  }

  if (!deviceConnected) {
    return "Device disconnected";
  }

  if (snapshot.loading && !snapshot.value) {
    return "Loading";
  }

  if (snapshot.error) {
    return snapshot.error;
  }

  if (snapshot.updatedAt) {
    return normalizeScpiQuery(config.query);
  }

  return "Waiting";
}

function noopSubscribe() {
  return () => {};
}

function snapshotsEqual(first, second) {
  return (
    first.value === second.value &&
    first.updatedAt === second.updatedAt &&
    first.loading === second.loading &&
    first.error === second.error
  );
}
