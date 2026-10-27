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
/** Renders editable target, command, and appearance settings. */
export function SingleToggleSettingsFields({ draft, deviceOptions, updateDraft }) {
  return (
    <>
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
    </>
  );
}
