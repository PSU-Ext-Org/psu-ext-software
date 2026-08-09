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
import { Download, Plus, Settings, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useModalDialog } from "../../../layout/hooks/useModalDialog.js";
import { ValidationMessage } from "../../../forms/ValidationMessage.jsx";
import { useWebSocketConnection } from "../../../../connection/ws-proxy/WebSocketConnectionContext.jsx";
import { connectedDevices } from "../../../../connection/ws-proxy/device/deviceRegistry.js";
import {
  saveExternalTriggerControlConfig,
  useExternalTriggerControlConfig,
} from "../triggerConfig.js";
import {
  applyDefaultTriggerConfig,
  validateDraftConfig,
} from "../utils/triggerHelpers.js";

export function ExternalTriggerSettings({ iconOnly = false, placement }) {
  const { devices = [], deviceStatuses = {} } = useWebSocketConnection();
  const [config, setConfig] = useExternalTriggerControlConfig(placement.id);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(config);
  const dialogRef = useModalDialog(open, () => setOpen(false));
  const connectedTargets = useMemo(
    () => connectedDevices(devices, deviceStatuses),
    [deviceStatuses, devices],
  );
  const deviceOptions = useMemo(
    () => (devices.length ? devices : connectedTargets),
    [connectedTargets, devices],
  );
  const errors = useMemo(() => validateDraftConfig(draft), [draft]);

  useEffect(() => {
    if (!open) {
      setDraft(config);
    }
  }, [config, open]);

  return (
    <>
      <button
        aria-label={iconOnly ? "Configure external trigger card" : undefined}
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
            className="grid max-h-[90vh] w-full max-w-3xl gap-4 overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              if (errors.length) {
                return;
              }

              setConfig(saveExternalTriggerControlConfig(placement.id, draft));
              setOpen(false);
            }}
          >
            <div className="flex min-w-0 items-start justify-between gap-4">
              <h3 className="text-lg font-semibold text-slate-950">External Trigger Settings</h3>
              <button
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-800">Defaults</p>
              <button
                className="control-standard inline-flex items-center justify-center gap-2 border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-100"
                onClick={() => setDraft((current) => applyDefaultTriggerConfig(current))}
                type="button"
              >
                <Download className="h-4 w-4" />
                Load default config
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Device
                <select
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  id="external-trigger-device"
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
                Card name
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  id="external-trigger-card-name"
                  onChange={(event) => updateDraft("cardName", event.target.value)}
                  placeholder="External Triggers"
                  value={draft.cardName}
                />
              </label>
            </div>

            <div className="grid gap-3">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Status query template
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  id="external-trigger-status-query-template"
                  onChange={(event) => updateDraft("statusQueryTemplate", event.target.value)}
                  placeholder="TRIG:CONF? {trigger},{state}"
                  value={draft.statusQueryTemplate}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Setup command template
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  id="external-trigger-setup-command-template"
                  onChange={(event) => updateDraft("setupCommandTemplate", event.target.value)}
                  placeholder="TRIG:CONF {trigger},{state},{command}"
                  value={draft.setupCommandTemplate}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Clear trigger value
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  id="external-trigger-clear-trigger-value"
                  onChange={(event) => updateDraft("clearTriggerValue", event.target.value)}
                  placeholder="NONE"
                  value={draft.clearTriggerValue}
                />
              </label>
            </div>

            <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-800">Trigger action options</p>
                <button
                  className="control-standard inline-flex items-center gap-2 border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-100"
                  onClick={addActionOption}
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                  Add action
                </button>
              </div>

              {draft.actionOptions.length ? (
                <div className="grid gap-2">
                  {draft.actionOptions.map((option, index) => (
                    <div
                      className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]"
                      key={option.id}
                    >
                      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                        Action name
                        <input
                          className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                          aria-label={`Action name ${index + 1}`}
                          onChange={(event) => updateActionOption(option.id, "name", event.target.value)}
                          placeholder="Output On"
                          value={option.name}
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                        SCPI command
                        <input
                          className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                          aria-label={`SCPI command ${index + 1}`}
                          onChange={(event) => updateActionOption(option.id, "scpiCommand", event.target.value)}
                          placeholder="OUT_ON,CH1"
                          value={option.scpiCommand}
                        />
                      </label>
                      <div className="flex items-end">
                        <button
                          aria-label={`Delete action ${index + 1}`}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                          onClick={() => removeActionOption(option.id)}
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-600">
                  Add action options or load the default trigger catalog.
                </p>
              )}
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

  function addActionOption() {
    setDraft((current) => ({
      ...current,
      actionOptions: [
        ...current.actionOptions,
        {
          id: `action-${Date.now()}-${current.actionOptions.length + 1}`,
          name: "",
          scpiCommand: "",
        },
      ],
    }));
  }

  function updateActionOption(id, key, value) {
    setDraft((current) => ({
      ...current,
      actionOptions: current.actionOptions.map((option) => (
        option.id === id
          ? {
            ...option,
            [key]: value,
          }
          : option
      )),
    }));
  }

  function removeActionOption(id) {
    setDraft((current) => ({
      ...current,
      actionOptions: current.actionOptions.filter((option) => option.id !== id),
    }));
  }
}
