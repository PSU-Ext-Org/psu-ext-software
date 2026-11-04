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
/**
 * Renders polling, optional write, and appearance settings for the dialog draft.
 * Hidden write fields remain in the draft so disabling does not erase them.
 *
 * @param {object} props
 * @param {object} props.draft - Editable config; frequency may be an input string.
 * @param {Array<{id: string, name: string}>} props.deviceOptions
 * @param {(key: string, value: string | boolean) => void} props.updateDraft
 * @returns {import("react").ReactElement}
 */
export function SingleValueSettingsFields({ draft, deviceOptions, updateDraft }) {
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
        SCPI query
        <input
          className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
          onChange={(event) => updateDraft("query", event.target.value)}
          placeholder="MEAS:VOLT? CH1"
          value={draft.query}
        />
      </label>

      <fieldset className="grid gap-3 rounded-md border border-slate-200 p-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            checked={draft.setValueEnabled}
            onChange={(event) => updateDraft("setValueEnabled", event.target.checked)}
            type="checkbox"
          />
          Enable value setting
        </label>

        {draft.setValueEnabled ? (
          <>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Set value SCPI command
              <input
                className="control-standard w-full border border-slate-300"
                onChange={(event) => updateDraft("setValueCommand", event.target.value)}
                placeholder="MEAS:CURR:REL CH1, {value}"
                value={draft.setValueCommand}
              />
            </label>

            <p className="text-xs text-slate-600">
              Use exactly one {"{value}"} placeholder for the value to send.
            </p>

            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Default value
              <input
                className="control-standard w-full border border-slate-300"
                onChange={(event) => updateDraft("defaultValue", event.target.value)}
                placeholder="Optional"
                value={draft.defaultValue}
              />
            </label>
          </>
        ) : null}
      </fieldset>

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
    </>
  );
}
