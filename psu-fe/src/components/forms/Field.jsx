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
import { useId } from "react";

/**
 * Labeled text input used by configuration forms.
 *
 * @param {object} props
 * @param {string} props.label - Label displayed above the input.
 * @param {string} props.placeholder - Example text shown when the input is empty.
 * @param {string} props.value - Current input value.
 * @param {(value: string) => void} props.onChange - Called with the next value.
 * @param {boolean} [props.disabled] - Disables editing when true.
 * @param {boolean} [props.hideLabel] - Keeps the label accessible but visually hidden.
 * @param {boolean} [props.required] - Marks the field as required.
 * @param {string} [props.hint] - Guidance displayed beneath the field.
 * @param {string} [props.errorMessage] - Inline validation feedback for the field.
 * @returns {import("react").ReactElement}
 */
export function Field({ label, placeholder, value, onChange, onKeyDown, disabled, hideLabel = false, required, hint, errorMessage }) {
  const descriptionId = useId();
  const description = errorMessage || hint;
  const field = (
    <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700">
      <span className={hideLabel ? "sr-only" : ""}>
        {label}{required ? <span aria-hidden="true"> *</span> : null}
      </span>
      <input
        aria-required={required}
        aria-invalid={errorMessage ? true : undefined}
        aria-describedby={description ? descriptionId : undefined}
        className="control-standard w-full min-w-0 border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
      />
    </label>
  );

  if (hint === undefined && errorMessage === undefined) return field;

  return (
    <div>
      {field}
      <p className={`text-xs ${errorMessage ? "text-rose-600" : "text-slate-600"}`} id={descriptionId} role="status">
        {description}
      </p>
    </div>
  );
}
