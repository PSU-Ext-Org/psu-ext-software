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
import { useState } from "react";
import { useSingleValueSet } from "../hooks/useSingleValueSet.js";
import { validateSetValue } from "../utils/singleValueCommands.js";

/**
 * Renders the editable argument and optional default action for one value card.
 * Matches the compact OVP/OCP unit-and-controls row inside the measurement panel.
 * The input remains independent of Default and is preserved after either action.
 *
 * @param {Parameters<typeof useSingleValueSet>[0]} props - Write configuration and connection APIs.
 * @returns {import("react").ReactElement}
 */
export function SingleValueSetControls(props) {
  const { config } = props;
  const [value, setValue] = useState("");
  const { disabled, message, sendValue } = useSingleValueSet(props);
  const setDisabled = disabled || Boolean(validateSetValue(value));
  const hasDefaultValue = Boolean(config.defaultValue.trim());

  function handleSet() {
    void sendValue(value);
  }

  function handleDefault() {
    void sendValue(config.defaultValue);
  }

  function handleSubmit(event) {
    event.preventDefault();
    handleSet();
  }

  return (
    <div className="mt-1 min-w-0" onPointerDown={(event) => event.stopPropagation()}>
      {/* Keep the input and actions beside the unit so the 1x1 card needs no extra rows. */}
      <form className="flex min-w-0 items-center justify-between gap-2" onSubmit={handleSubmit}>
        <span className="min-w-0 truncate text-sm font-medium text-slate-600">
          {config.unit || "\u00a0"}
        </span>

        <div className="ml-auto flex min-w-0 items-center justify-end gap-1">
          <input
            aria-label="Set value"
            className="h-7 min-w-0 w-20 rounded-md border border-slate-300 bg-white px-1.5 text-xs text-slate-950 outline-none focus:border-teal-700"
            onChange={(event) => setValue(event.target.value)}
            placeholder="Set"
            type="text"
            value={value}
          />

          <button
            className="h-7 shrink-0 rounded-md bg-teal-700 px-2 text-xs text-white hover:bg-teal-800 disabled:opacity-50"
            disabled={setDisabled}
            type="submit"
          >
            Set
          </button>

          {hasDefaultValue ? (
            <button
              className="h-7 shrink-0 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={disabled}
              onClick={handleDefault}
              type="button"
            >
              Default
            </button>
          ) : null}
        </div>
      </form>

      {message ? (
        <p className="truncate text-xs text-slate-600" role="status" title={message}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
