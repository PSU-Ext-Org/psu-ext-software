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
import { Plus } from "lucide-react";
import { ValidationMessage } from "../../../forms/ValidationMessage.jsx";
import { createEmptyTimerRow, TIMER_QUEUE_LIMITS } from "../timerQueueConfig.js";
import { TimerQueueRow } from "./TimerQueueRow.jsx";

/**
 * Renders timer-preset rows, editor actions, and target summary information.
 *
 * @param {{
 *   config: {channel: string, deviceName: string},
 *   editor: {
 *     addTimer: Function,
 *     deleteTimer: Function,
 *     dirty: boolean,
 *     draftTimers: Array<object>,
 *     draftValidation: object | null,
 *     savePreset: Function,
 *     updateTimer: Function,
 *   },
 *   helperText: string,
 * }} props - Persisted configuration and preset editor model.
 * @returns {import("react").ReactElement} Timer preset editor.
 */
export function TimerQueueEditor({ config, editor, helperText }) {
  const {
    addTimer,
    deleteTimer,
    dirty,
    draftTimers,
    draftValidation,
    savePreset,
    updateTimer,
  } = editor;
  const draftValidationError = draftValidation?.message || "";
  const canDeleteTimer = draftTimers.length > 1;
  const timerCountLabel = `${draftTimers.length} timer${draftTimers.length === 1 ? "" : "s"}`;

  return (
    <div className="grid min-h-0 flex-1 gap-3">
      <div className="min-h-0 overflow-auto pr-1">
        <div className="grid gap-2">
          {draftTimers.map((timer, index) => (
            <TimerQueueRow
              canDelete={canDeleteTimer}
              errors={getRowErrors(draftValidation, index)}
              index={index}
              key={`${config.deviceName || "timer"}-${index}`}
              onDelete={deleteTimer}
              onUpdate={updateTimer}
              timer={timer}
            />
          ))}
        </div>
      </div>

      <div className="mt-auto grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={draftTimers.length >= TIMER_QUEUE_LIMITS.maxTimers}
            onClick={handleAddTimer}
            type="button"
          >
            <Plus className="h-4 w-4" />
            Add timer
          </button>
          <button
            className="control-standard bg-teal-700 font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!dirty || Boolean(draftValidationError)}
            onClick={savePreset}
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
            <strong className="truncate text-right">{timerCountLabel}</strong>
          </div>
        </div>
      </div>
    </div>
  );

  function handleAddTimer() {
    addTimer(createEmptyTimerRow());
  }
}

function getRowErrors(validation, index) {
  return {
    id: validation?.rowIndex === index && validation?.field === "id" ? validation.message : "",
    durationSeconds: validation?.rowIndex === index && validation?.field === "durationSeconds"
      ? validation.message
      : "",
  };
}
