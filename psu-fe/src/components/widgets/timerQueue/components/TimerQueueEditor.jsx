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
import { Plus, Trash2 } from "lucide-react";
import { InputValidationPopover } from "../../../forms/InputValidationPopover.jsx";
import { ValidationMessage } from "../../../forms/ValidationMessage.jsx";
import { createEmptyTimerRow, getTimerQueueConfigLimits } from "../timerQueueConfig.js";

export function TimerQueueEditor({
  config,
  draftTimers,
  draftValidation,
  dirty,
  helperText,
  onAddTimer,
  onDeleteTimer,
  onSavePreset,
  onUpdateTimer,
}) {
  const draftValidationError = draftValidation?.message || "";

  return (
    <div className="grid min-h-0 flex-1 gap-3">
      <div className="min-h-0 overflow-auto pr-1">
        <div className="grid gap-2">
        {draftTimers.map((timer, index) => {
          const idError = draftValidation?.rowIndex === index && draftValidation?.field === "id"
            ? draftValidation.message
            : "";
          const durationError = draftValidation?.rowIndex === index && draftValidation?.field === "durationSeconds"
            ? draftValidation.message
            : "";

          return (
            <div
              className="grid gap-2 rounded-md border border-slate-200 bg-white px-3 py-3 shadow-sm sm:grid-cols-[4.5rem_minmax(0,1fr)_7rem_2.5rem]"
              key={`${config.deviceName || "timer"}-${index}`}
            >
              <TimerTextField
                align="left"
                error={idError}
                label="ID"
                maxLength={getTimerQueueConfigLimits().timerIdLength}
                name={`Timer id ${index + 1}`}
                onChange={(event) => onUpdateTimer(index, "id", event.target.value)}
                placeholder="A01"
                value={timer.id}
              />
              <TimerTextField
                error={durationError}
                label="Seconds"
                name={`Timer duration ${index + 1}`}
                onChange={(event) => onUpdateTimer(index, "durationSeconds", event.target.value)}
                placeholder="5.000"
                value={timer.durationSeconds}
              />
              <label className="grid gap-1 text-xs font-medium text-slate-600">
                Relay after
                <select
                  aria-label={`Timer relay state ${index + 1}`}
                  className="control-standard w-full border border-slate-300 bg-white text-sm text-slate-950 outline-none focus:border-teal-700"
                  onChange={(event) => onUpdateTimer(index, "relayOnAfterExpiry", event.target.value === "1")}
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
                  disabled={draftTimers.length <= 1}
                  onClick={() => onDeleteTimer(index)}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        })}
        </div>
      </div>

      <div className="mt-auto grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={draftTimers.length >= getTimerQueueConfigLimits().maxTimers}
            onClick={() => onAddTimer(createEmptyTimerRow())}
            type="button"
          >
            <Plus className="h-4 w-4" />
            Add timer
          </button>
          <button
            className="control-standard bg-teal-700 font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!dirty || Boolean(draftValidationError)}
            onClick={onSavePreset}
            type="button"
          >
            Save preset
          </button>
        </div>

        <ValidationMessage message={draftValidation?.field ? "" : draftValidationError} />

        <div className="grid gap-1 text-xs text-slate-600">
          <div className="flex min-w-0 justify-between gap-3">
            <span className="truncate">
              <span className="text-slate-500">Target:</span> {config.deviceName || "Not configured"}
            </span>
            <strong className="truncate text-right">{helperText}</strong>
          </div>
          <div className="flex min-w-0 justify-between gap-3">
            <span className="truncate">
              <span className="text-slate-500">Channel:</span> {config.channel}
            </span>
            <strong className="truncate text-right">{draftTimers.length} timer{draftTimers.length === 1 ? "" : "s"}</strong>
          </div>
        </div>
      </div>
    </div>
  );
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
      <InputValidationPopover align={align} anchorRef={inputRef} message={error} portal />
    </label>
  );
}
