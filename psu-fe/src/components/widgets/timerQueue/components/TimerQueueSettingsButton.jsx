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
import { useEffect, useMemo, useState } from "react";
import { ValidationMessage } from "../../../forms/ValidationMessage.jsx";
import { useModalDialog } from "../../../layout/hooks/useModalDialog.js";
import { useWebSocketConnection } from "../../../../connection/ws-proxy/WebSocketConnectionContext.jsx";
import { connectedDevices } from "../../../../connection/ws-proxy/device/deviceRegistry.js";
import {
  DEFAULT_TIMER_QUEUE_CONTROL_CONFIG,
  saveTimerQueueControlConfig,
  useTimerQueueControlConfig,
} from "../timerQueueConfig.js";

export function TimerQueueSettingsButton({ iconOnly = false, placement, timers }) {
  const { devices = [], deviceStatuses = {} } = useWebSocketConnection();
  const [config, setConfig] = useTimerQueueControlConfig(placement.id);
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
  const validationError = String(draft.deviceName || "").trim() ? "" : "Select a target device.";

  useEffect(() => {
    if (!open) {
      setDraft(config);
    }
  }, [config, open]);

  return (
    <>
      <button
        aria-label={iconOnly ? "Configure timer queue card" : undefined}
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
            className="grid w-full max-w-md gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              if (validationError) {
                return;
              }

              setConfig(saveTimerQueueControlConfig(placement.id, {
                ...draft,
                timers: timers ?? config.timers,
              }));
              setOpen(false);
            }}
          >
            <div className="flex min-w-0 items-start justify-between gap-4">
              <h3 className="text-lg font-semibold text-slate-950">Timer Queue Settings</h3>
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
                {deviceOptions.map((deviceOption) => (
                  <option key={deviceOption.id} value={deviceOption.name}>
                    {deviceOption.id} / {deviceOption.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Card name
              <input
                className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                onChange={(event) => updateDraft("cardName", event.target.value)}
                placeholder="Timer Queue"
                value={draft.cardName}
              />
            </label>

            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Channel is fixed to CH1. Use only one timer widget per device/channel to avoid queue drift.
            </p>

            <ValidationMessage message={validationError} />

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
                disabled={Boolean(validationError)}
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
      [key]: key === "cardName"
        ? String(value).trim().slice(0, 48) || DEFAULT_TIMER_QUEUE_CONTROL_CONFIG.cardName
        : value,
    }));
  }
}
