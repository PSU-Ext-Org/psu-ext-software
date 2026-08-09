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
import { Power, Settings } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useModalDialog } from "../../../layout/hooks/useModalDialog.js";
import { useWebSocketConnection } from "../../../../connection/ws-proxy/WebSocketConnectionContext.jsx";
import { connectedDevices } from "../../../../connection/ws-proxy/device/deviceRegistry.js";
import { MONITOR_TAG } from "../../../../connection/ws-proxy/monitor/monitorTagQueue.js";
import {
  normalizeScpiCommand,
  normalizeScpiQuery,
  validateScpiCommand,
  validateScpiQuery,
} from "../../../../connection/ws-proxy/scpi/scpiQueryValidation.js";
import { ValidationMessage } from "../../../forms/ValidationMessage.jsx";
import {
  DEFAULT_SINGLE_TOGGLE_CONFIG,
  saveSingleToggleConfig,
  useSingleToggleConfig,
} from "../singleToggleConfig.js";
import { normalizeFrequency } from "../../singleValue/singleValueConfig.js";

const INITIAL_TOGGLE_STATUS = Object.freeze({
  state: "unknown",
  busy: false,
  message: "Waiting",
});
const pendingAutoStatusChecks = new Map();

/**
 * Dynamic dashboard title for a persisted SingleToggleCard instance.
 *
 * @param {{placement: {id: string}}} props
 * @returns {import("react").ReactElement}
 */
export function SingleToggleCardTitle({ placement }) {
  const [config] = useSingleToggleConfig(placement.id);

  return <>{config.cardName || DEFAULT_SINGLE_TOGGLE_CONFIG.cardName}</>;
}

/**
 * Header action for configuring a persisted SingleToggleCard instance.
 *
 * @param {{placement: {id: string}}} props
 * @returns {import("react").ReactElement}
 */
export function SingleToggleCardActions({ placement }) {
  return <SingleToggleSettingsButton iconOnly placement={placement} />;
}

/**
 * 1x1 dashboard widget that controls a binary SCPI state.
 *
 * @param {{placement: {id: string}}} props
 * @returns {import("react").ReactElement}
 */
export function SingleToggleCard({ placement }) {
  const {
    getScpiQuerySnapshot = noopSnapshot,
    subscribeScpiSnapshot = noopSubscribe,
    wsConnected,
    devices = [],
    deviceStatuses = {},
    sendScpiCommand = missingSendScpiCommand,
  } = useWebSocketConnection();
  const [config] = useSingleToggleConfig(placement.id);
  const [status, setStatus] = useState(INITIAL_TOGGLE_STATUS);
  const requestSequenceRef = useRef(0);
  const lastSnapshotRef = useRef(null);
  const deviceByName = useMemo(
    () => new Map(devices.map((candidate) => [candidate.name, candidate])),
    [devices],
  );
  const validationError = validateRunnableConfig(config);
  const device = deviceByName.get(config.deviceName);
  const deviceConnected = Boolean(device && deviceStatuses[device.id]?.state === "CONNECTED");
  const runnable = !validationError && wsConnected && device && deviceConnected;
  const subscribeSnapshot = useCallback(
    (listener) => subscribeScpiSnapshot(config.deviceName, config.statusCommand, listener),
    [config.deviceName, config.statusCommand, subscribeScpiSnapshot],
  );
  const getSnapshot = useCallback(() => {
    const nextSnapshot = getScpiQuerySnapshot(config.deviceName, config.statusCommand);
    if (lastSnapshotRef.current && snapshotsEqual(lastSnapshotRef.current, nextSnapshot)) {
      return lastSnapshotRef.current;
    }

    lastSnapshotRef.current = nextSnapshot;
    return nextSnapshot;
  }, [config.deviceName, config.statusCommand, getScpiQuerySnapshot]);
  const snapshot = useSyncExternalStore(subscribeSnapshot, getSnapshot, getSnapshot);
  const displayText = status.state === "on" ? "ON" : status.state === "off" ? "OFF" : "--";
  const helperText = getHelperText({
    autoRefreshEnabled: config.autoRefreshEnabled,
    device,
    deviceConnected,
    snapshot,
    status,
    validationError,
    wsConnected,
  });
  const actionLabel =
    status.state === "on" ? "Turn off" : status.state === "off" ? "Turn on" : "Check";
  const actionDisabled = !runnable || status.busy;

  const checkStatus = useCallback(
    async ({ autoStatusKey = "", busy = true, message = "Checking status" } = {}) => {
      const sequence = requestSequenceRef.current + 1;
      requestSequenceRef.current = sequence;
      if (busy) {
        setStatus((current) => ({ ...current, busy: true, message }));
      }

      try {
        const result = await runStatusCommand({
          autoStatusKey,
          command: config.statusCommand,
          deviceName: config.deviceName,
          sendScpiCommand,
        });
        const nextState = mapStatusResponse(result.response, config);
        if (requestSequenceRef.current === sequence) {
          setStatus({
            state: nextState,
            busy: false,
            message: nextState === "unknown" ? `Unexpected response: ${result.response}` : "Ready",
          });
        }
        return nextState;
      } catch (error) {
        if (requestSequenceRef.current === sequence) {
          setStatus({
            state: "unknown",
            busy: false,
            message: error instanceof Error ? error.message : "Status check failed.",
          });
        }
        return "unknown";
      }
    },
    [config, sendScpiCommand],
  );

  useEffect(() => {
    requestSequenceRef.current += 1;
    if (!runnable) {
      setStatus(INITIAL_TOGGLE_STATUS);
      return undefined;
    }

    checkStatus({
      autoStatusKey: createAutoStatusKey(placement.id, config),
      busy: true,
      message: "Checking status",
    });
    return () => {
      requestSequenceRef.current += 1;
    };
  }, [checkStatus, config, placement.id, runnable]);

  useEffect(() => {
    if (!config.autoRefreshEnabled || status.busy || !snapshot.updatedAt) {
      return;
    }

    const nextState = mapStatusResponse(snapshot.value, config);
    setStatus((current) => {
      if (current.busy) {
        return current;
      }

      const nextMessage = nextState === "unknown" ? `Unexpected response: ${snapshot.value}` : "Ready";
      if (current.state === nextState && current.message === nextMessage) {
        return current;
      }

      return {
        state: nextState,
        busy: false,
        message: nextMessage,
      };
    });
  }, [config, snapshot.updatedAt, snapshot.value, status.busy]);

  if (!config.deviceName || !config.statusCommand || !config.onCommand || !config.offCommand) {
    return (
      <div className="flex min-h-full flex-col gap-3">
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Configure a target device and toggle commands.
        </p>
        <div className="mt-auto">
          <SingleToggleSettingsButton placement={placement} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-3">
      <button
        className="min-w-0 rounded-md bg-slate-100 px-3 py-3 text-left transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
        data-testid={`single-toggle-${placement.id}`}
        disabled={actionDisabled}
        onClick={handleToggle}
        type="button"
      >
        <span
          className="block truncate text-3xl font-semibold leading-tight"
          style={{ color: status.state === "unknown" ? "#475569" : config.statusColor }}
        >
          {displayText}
        </span>
        <span className="mt-1 block truncate text-sm font-medium text-slate-600">{actionLabel}</span>
      </button>
      <div className="mt-auto grid gap-1 text-xs text-slate-600">
        <div className="flex min-w-0 justify-between gap-3">
          <span className="shrink-0">Target</span>
          <strong className="min-w-0 truncate text-right">{config.deviceName}</strong>
        </div>
        <div className="flex min-w-0 justify-between gap-3">
          <span className="shrink-0">Status</span>
          <strong className="min-w-0 truncate text-right">{helperText}</strong>
        </div>
      </div>
    </div>
  );

  async function handleToggle() {
    if (!runnable || status.busy) {
      return;
    }

    if (status.state !== "on" && status.state !== "off") {
      await checkStatus({ busy: true, message: "Checking status" });
      return;
    }

    const targetState = status.state === "on" ? "off" : "on";
    const preChangeState = await checkStatus({ busy: true, message: "Checking before change" });
    if (preChangeState === "unknown") {
      return;
    }

    if (preChangeState === targetState) {
      setStatus({ state: targetState, busy: false, message: "Ready" });
      return;
    }

    const sequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = sequence;
    setStatus((current) => ({ ...current, busy: true, message: `Turning ${targetState}` }));

    try {
      await sendToggleCommand(
        sendScpiCommand,
        config.deviceName,
        targetState === "on" ? config.onCommand : config.offCommand,
      );
      const verifiedState = await checkStatus({ busy: true, message: "Verifying status" });
      if (verifiedState !== targetState && requestSequenceRef.current === sequence + 1) {
        setStatus({
          state: verifiedState,
          busy: false,
          message: `Verification failed: expected ${targetState.toUpperCase()}.`,
        });
      }
    } catch (error) {
      if (requestSequenceRef.current === sequence) {
        setStatus({
          state: preChangeState,
          busy: false,
          message: error instanceof Error ? error.message : "Toggle command failed.",
        });
      }
    }
  }
}

function SingleToggleSettingsButton({ iconOnly = false, placement }) {
  const { devices = [], deviceStatuses = {} } = useWebSocketConnection();
  const [config, setConfig] = useSingleToggleConfig(placement.id);
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
        aria-label={iconOnly ? "Configure single toggle card" : undefined}
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

              setConfig(saveSingleToggleConfig(placement.id, draft));
              setOpen(false);
            }}
          >
            <div className="flex min-w-0 items-start justify-between gap-4">
              <h3 className="text-lg font-semibold text-slate-950">Single Toggle Settings</h3>
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
              Status command
              <input
                className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                onChange={(event) => updateDraft("statusCommand", event.target.value)}
                placeholder="OUTP? CH1"
                value={draft.statusCommand}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                On command
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  onChange={(event) => updateDraft("onCommand", event.target.value)}
                  placeholder="OUTP CH1,1"
                  value={draft.onCommand}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Off command
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  onChange={(event) => updateDraft("offCommand", event.target.value)}
                  placeholder="OUTP CH1,0"
                  value={draft.offCommand}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                On response
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  onChange={(event) => updateDraft("onResponse", event.target.value)}
                  value={draft.onResponse}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Off response
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  onChange={(event) => updateDraft("offResponse", event.target.value)}
                  value={draft.offResponse}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem]">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Card name
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  onChange={(event) => updateDraft("cardName", event.target.value)}
                  placeholder="Output"
                  value={draft.cardName}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Color
                <input
                  className="h-8 w-full rounded-md border border-slate-300 bg-white p-1"
                  onChange={(event) => updateDraft("statusColor", event.target.value)}
                  type="color"
                  value={draft.statusColor}
                />
              </label>
            </div>

            <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_8rem] sm:items-end">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  checked={draft.autoRefreshEnabled}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                  onChange={(event) => updateDraft("autoRefreshEnabled", event.target.checked)}
                  type="checkbox"
                />
                Optional status refresh
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Frequency (Hz)
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 focus:border-teal-700"
                  disabled={!draft.autoRefreshEnabled}
                  max="100"
                  min="0.1"
                  onChange={(event) => updateDraft("refreshFrequencyHz", event.target.value)}
                  step="0.1"
                  type="number"
                  value={draft.refreshFrequencyHz}
                />
              </label>
            </div>

            <ValidationMessage message={errors[0]} />

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
      [key]: value,
    }));
  }
}

function validateDraft(draft) {
  const errors = [];
  const statusError = validateScpiQuery(draft.statusCommand);
  const onError = validateScpiCommand(draft.onCommand);
  const offError = validateScpiCommand(draft.offCommand);
  const onResponse = String(draft.onResponse || "").trim();
  const offResponse = String(draft.offResponse || "").trim();
  const refreshFrequency = normalizeFrequency(draft.refreshFrequencyHz);

  if (!String(draft.deviceName || "").trim()) {
    errors.push("Select a target device.");
  }

  if (statusError) {
    errors.push(statusError);
  }

  if (onError) {
    errors.push(onError);
  }

  if (offError) {
    errors.push(offError);
  }

  if (!onResponse || !offResponse) {
    errors.push("Enter on and off response mappings.");
  }

  if (onResponse && onResponse === offResponse) {
    errors.push("On and off responses must be different.");
  }

  if (draft.autoRefreshEnabled && Number.parseFloat(draft.refreshFrequencyHz) !== refreshFrequency) {
    errors.push("Frequency must be between 0.1 Hz and 100 Hz.");
  }

  return errors;
}

function validateRunnableConfig(config) {
  if (!config.deviceName || !config.statusCommand || !config.onCommand || !config.offCommand) {
    return "Configure this toggle.";
  }

  return (
    validateScpiQuery(config.statusCommand) ||
    validateScpiCommand(config.onCommand) ||
    validateScpiCommand(config.offCommand)
  );
}

function mapStatusResponse(response, config) {
  const normalizedResponse = String(response ?? "").trim();
  if (normalizedResponse === String(config.onResponse).trim()) {
    return "on";
  }

  if (normalizedResponse === String(config.offResponse).trim()) {
    return "off";
  }

  return "unknown";
}

function getHelperText({
  autoRefreshEnabled,
  device,
  deviceConnected,
  snapshot,
  status,
  validationError,
  wsConnected,
}) {
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

  if (status.busy) {
    return status.message;
  }

  if (autoRefreshEnabled) {
    if (snapshot.loading && status.state === "unknown" && !snapshot.updatedAt) {
      return "Checking status";
    }

    if (snapshot.error) {
      return snapshot.error;
    }
  }

  return status.message;
}

function sendToggleCommand(sendScpiCommand, deviceName, command) {
  return sendScpiCommand(command, deviceName, {
    tag: MONITOR_TAG.GUI,
    waitForResponse: true,
  });
}

function runStatusCommand({ autoStatusKey, command, deviceName, sendScpiCommand }) {
  if (!autoStatusKey) {
    return sendToggleCommand(sendScpiCommand, deviceName, command);
  }

  const pending = pendingAutoStatusChecks.get(autoStatusKey);
  if (pending) {
    return pending;
  }

  const nextPending = sendToggleCommand(sendScpiCommand, deviceName, command).finally(() => {
    if (pendingAutoStatusChecks.get(autoStatusKey) === nextPending) {
      pendingAutoStatusChecks.delete(autoStatusKey);
    }
  });
  pendingAutoStatusChecks.set(autoStatusKey, nextPending);
  return nextPending;
}

function createAutoStatusKey(widgetId, config) {
  return [
    widgetId,
    config.deviceName,
    config.statusCommand,
    config.onResponse,
    config.offResponse,
  ].join("\u001f");
}

function missingSendScpiCommand() {
  return Promise.reject(new Error("SCPI command sender is unavailable."));
}

function noopSubscribe() {
  return () => {};
}

function noopSnapshot() {
  return {
    value: "",
    updatedAt: 0,
    loading: false,
    error: "",
  };
}

function snapshotsEqual(first, second) {
  return (
    first.value === second.value &&
    first.updatedAt === second.updatedAt &&
    first.loading === second.loading &&
    first.error === second.error
  );
}

export const SingleToggleIcon = Power;
