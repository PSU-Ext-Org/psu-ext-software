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
 * Compact pill toggle with a centered sliding thumb.
 *
 * @param {object} props
 * @param {string} props.ariaLabel
 * @param {boolean} props.checked
 * @param {boolean} [props.disabled]
 * @param {() => void} props.onClick
 * @returns {import("react").ReactElement}
 */
export function SlidingToggle({ ariaLabel, checked, disabled = false, onClick }) {
  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={checked}
      className={[
        "relative inline-flex h-6 w-11 items-center rounded-full border transition disabled:opacity-50",
        checked
          ? "border-emerald-700 bg-emerald-600"
          : "border-rose-700 bg-rose-600",
      ].join(" ")}
      disabled={disabled}
      onClick={onClick}
      title={checked ? "Enabled" : "Disabled"}
      type="button"
    >
      <span
        className={[
          "absolute top-1/2 left-1 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-0" : "translate-x-5",
        ].join(" ")}
      />
    </button>
  );
}
