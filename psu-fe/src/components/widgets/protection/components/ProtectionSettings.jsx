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
import { Download, Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useModalDialog } from "../../../layout/hooks/useModalDialog.js";
import { ValidationMessage } from "../../../forms/ValidationMessage.jsx";
import { useWebSocketConnection } from "../../../../connection/ws-proxy/WebSocketConnectionContext.jsx";
import { connectedDevices } from "../../../../connection/ws-proxy/device/deviceRegistry.js";
import {
  saveProtectionControlConfig,
  useProtectionControlConfig,
} from "../protectionConfig.js";
import { normalizeFrequency } from "../../singleValue/singleValueConfig.js";
import {
  applyProtectionPreset,
  validateDraftConfig,
} from "../utils/protectionHelpers.js";

export function ProtectionSettings({ iconOnly = false, placement }) {
  const { devices = [], deviceStatuses = {} } = useWebSocketConnection();
  const [config, setConfig] = useProtectionControlConfig(placement.id);
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
  const errors = useMemo(() => validateDraftConfig(draft), [draft]);

  useEffect(() => {
    if (!open) {
      setDraft(config);
    }
  }, [config, open]);

  return (
    <>
      <button
        aria-label={iconOnly ? "Configure protection control card" : undefined}
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
            className="grid max-h-[90vh] w-full max-w-2xl gap-4 overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              if (errors.length) {
                return;
              }

              setConfig(saveProtectionControlConfig(placement.id, draft));
              setOpen(false);
            }}
          >
            <div className="flex min-w-0 items-start justify-between gap-4">
              <h3 className="text-lg font-semibold text-slate-950">Protection Control Settings</h3>
              <button
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-800">Presets</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  className="control-standard border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-100"
                  onClick={() => setDraft(applyProtectionPreset(draft, "OVP"))}
                  type="button"
                >
                  <span className="inline-flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Load OVP
                  </span>
                </button>
                <button
                  className="control-standard border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-100"
                  onClick={() => setDraft(applyProtectionPreset(draft, "OCP"))}
                  type="button"
                >
                  <span className="inline-flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Load OCP
                  </span>
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem]">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Device
                <select
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  id="protection-device"
                  name="deviceName"
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
                  id="protection-card-name"
                  name="cardName"
                  onChange={(event) => updateDraft("cardName", event.target.value)}
                  placeholder="OVP CH1"
                  value={draft.cardName}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Value color
                <input
                  className="h-8 w-full rounded-md border border-slate-300 bg-white p-1"
                  id="protection-value-color"
                  name="valueColor"
                  onChange={(event) => updateDraft("valueColor", event.target.value)}
                  type="color"
                  value={draft.valueColor}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Protection key
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  id="protection-key"
                  name="protectionKey"
                  onChange={(event) => updateDraft("protectionKey", event.target.value.toUpperCase())}
                  placeholder="OVP"
                  value={draft.protectionKey}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Channel
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  id="protection-channel"
                  name="channel"
                  onChange={(event) => updateDraft("channel", event.target.value)}
                  placeholder="CH1"
                  value={draft.channel}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Unit
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  id="protection-unit"
                  name="unit"
                  onChange={(event) => updateDraft("unit", event.target.value)}
                  placeholder="V"
                  value={draft.unit}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Trip poll (Hz)
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  id="protection-frequency-hz"
                  max="100"
                  min="0.1"
                  name="frequencyHz"
                  onChange={(event) => updateDraft("frequencyHz", event.target.value)}
                  step="0.1"
                  type="number"
                  value={draft.frequencyHz}
                />
              </label>
            </div>

            <div className="grid gap-3">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Value query
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  id="protection-value-query"
                  name="valueQuery"
                  onChange={(event) => updateDraft("valueQuery", event.target.value)}
                  placeholder="OVP? CH1"
                  value={draft.valueQuery}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Value set template
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  id="protection-value-set-template"
                  name="valueSetTemplate"
                  onChange={(event) => updateDraft("valueSetTemplate", event.target.value)}
                  placeholder="OVP CH1,{value}"
                  value={draft.valueSetTemplate}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Trip query
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  id="protection-trip-query"
                  name="tripQuery"
                  onChange={(event) => updateDraft("tripQuery", event.target.value)}
                  placeholder="OVP:PROTect:STATe? CH1"
                  value={draft.tripQuery}
                />
              </label>
            </div>

            <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-800">Optional enable/disable commands</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                  Enable query
                  <input
                    className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                    id="protection-enable-query"
                    name="enableQuery"
                    onChange={(event) => updateDraft("enableQuery", event.target.value)}
                    placeholder="OCP:STATe? CH1"
                    value={draft.enableQuery}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                  Enable on command
                  <input
                    className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                    id="protection-enable-on-command"
                    name="enableOnCommand"
                    onChange={(event) => updateDraft("enableOnCommand", event.target.value)}
                    placeholder="OCP:STATe CH1,1"
                    value={draft.enableOnCommand}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                  Enable off command
                  <input
                    className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                    id="protection-enable-off-command"
                    name="enableOffCommand"
                    onChange={(event) => updateDraft("enableOffCommand", event.target.value)}
                    placeholder="OCP:STATe CH1,0"
                    value={draft.enableOffCommand}
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                  Enabled response
                  <input
                    className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                    id="protection-enabled-response"
                    name="enabledResponse"
                    onChange={(event) => updateDraft("enabledResponse", event.target.value)}
                    value={draft.enabledResponse}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                  Disabled response
                  <input
                    className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                    id="protection-disabled-response"
                    name="disabledResponse"
                    onChange={(event) => updateDraft("disabledResponse", event.target.value)}
                    value={draft.disabledResponse}
                  />
                </label>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Min value
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  id="protection-min-value"
                  name="minValue"
                  onChange={(event) => updateDraft("minValue", event.target.value)}
                  type="number"
                  value={draft.minValue}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Max value
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  id="protection-max-value"
                  name="maxValue"
                  onChange={(event) => updateDraft("maxValue", event.target.value)}
                  type="number"
                  value={draft.maxValue}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Decimals
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  id="protection-decimals"
                  max="6"
                  min="0"
                  name="decimals"
                  onChange={(event) => updateDraft("decimals", event.target.value)}
                  step="1"
                  type="number"
                  value={draft.decimals}
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
      [key]: key === "frequencyHz" ? normalizeFrequency(value) : value,
    }));
  }
}
