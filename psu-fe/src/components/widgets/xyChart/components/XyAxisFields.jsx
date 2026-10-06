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
const INPUT_CLASS =
  "control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700";

/**
 * Device, SCPI query, label and unit fields for one axis of the X-Y chart settings form.
 *
 * @param {object} props
 * @param {"x" | "y"} props.axis
 * @param {{label: string, unit: string, deviceName: string, query: string}} props.value
 * @param {Array<{id: string, name: string}>} props.deviceOptions
 * @param {(key: string, value: string) => void} props.onChange
 * @returns {import("react").ReactElement}
 */
export function XyAxisFields({ axis, value, deviceOptions, onChange }) {
  const name = axis.toUpperCase();

  return (
    <fieldset className="grid gap-3 rounded-md border border-slate-200 p-3">
      <legend className="px-1 text-sm font-semibold text-slate-800">{name} axis</legend>

      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
        {name} device
        <select className={INPUT_CLASS} onChange={(event) => onChange("deviceName", event.target.value)} value={value.deviceName}>
          <option value="">Select device</option>
          {deviceOptions.map((device) => (
            <option key={device.id} value={device.name}>
              {device.id} / {device.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
        {name} SCPI query
        <input
          className={INPUT_CLASS}
          onChange={(event) => onChange("query", event.target.value)}
          placeholder={axis === "x" ? "MEAS:VOLT? CH1" : "MEAS:CURR? CH1"}
          value={value.query}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem]">
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          {name} label
          <input
            className={INPUT_CLASS}
            onChange={(event) => onChange("label", event.target.value)}
            placeholder={axis === "x" ? "Voltage" : "Current"}
            value={value.label}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          {name} unit
          <input
            className={INPUT_CLASS}
            onChange={(event) => onChange("unit", event.target.value)}
            placeholder={axis === "x" ? "V" : "A"}
            value={value.unit}
          />
        </label>
      </div>
    </fieldset>
  );
}
