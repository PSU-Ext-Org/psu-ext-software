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
import { useRef } from "react";
import { Trash2 } from "lucide-react";
import { InputValidationPopover } from "../../../forms/InputValidationPopover.jsx";
import { TIMER_QUEUE_LIMITS } from "../timerQueueConfig.js";

/**
 * Renders one editable timer step and its field-level validation.
 *
 * @param {{
 *   canDelete: boolean,
 *   errors: {durationSeconds: string, id: string},
 *   index: number,
 *   onDelete: (index: number) => void,
 *   onUpdate: (index: number, key: string, value: unknown) => void,
 *   timer: {durationSeconds: string, id: string, relayOnAfterExpiry: boolean},
 * }} props - Timer row data and editor actions.
 * @returns {import("react").ReactElement} Editable timer row.
 */
export function TimerQueueRow({ canDelete, errors, index, onDelete, onUpdate, timer }) {
  return (
    <div className="grid gap-2 rounded-md border border-slate-200 bg-white px-3 py-3 shadow-sm sm:grid-cols-[4.5rem_minmax(0,1fr)_7rem_2.5rem]">
      <TimerTextField
        align="left"
        error={errors.id}
        label="ID"
        maxLength={TIMER_QUEUE_LIMITS.timerIdLength}
        name={`Timer id ${index + 1}`}
        onChange={handleIdChange}
        placeholder="A01"
        value={timer.id}
      />
      <TimerTextField
        error={errors.durationSeconds}
        label="Seconds"
        name={`Timer duration ${index + 1}`}
        onChange={handleDurationChange}
        placeholder="5.000"
        value={timer.durationSeconds}
      />
      <label className="grid gap-1 text-xs font-medium text-slate-600">
        Relay after
        <select
          aria-label={`Timer relay state ${index + 1}`}
          className="control-standard w-full border border-slate-300 bg-white text-sm text-slate-950 outline-none focus:border-teal-700"
          onChange={handleRelayChange}
          value={timer.relayOnAfterExpiry ? "1" : "0"}
        >
          <option value="0">OFF</option>
          <option value="1">ON</option>
        </select>
      </label>
      <div className="flex items-end">
        <button
          aria-label={`Delete timer ${index + 1}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canDelete}
          onClick={handleDelete}
          type="button"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  function handleIdChange(event) {
    onUpdate(index, "id", event.target.value);
  }

  function handleDurationChange(event) {
    onUpdate(index, "durationSeconds", event.target.value);
  }

  function handleRelayChange(event) {
    onUpdate(index, "relayOnAfterExpiry", event.target.value === "1");
  }

  function handleDelete() {
    onDelete(index);
  }
}

function TimerTextField({ align = "right", error = "", label, maxLength, name, onChange, placeholder, value }) {
  const inputRef = useRef(null);

  return (
    <label className="relative grid gap-1 text-xs font-medium text-slate-600">
      {label}
      <input
        aria-label={name}
        className={[
          "control-standard w-full bg-white text-sm text-slate-950 outline-none",
          error
            ? "border border-rose-500 focus:border-rose-600"
            : "border border-slate-300 focus:border-teal-700",
        ].join(" ")}
        maxLength={maxLength}
        onChange={onChange}
        placeholder={placeholder}
        ref={inputRef}
        value={value}
      />
      <InputValidationPopover
        align={align}
        anchorRef={inputRef}
        message={error}
        portal
      />
    </label>
  );
}
