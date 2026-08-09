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
 * Compact log-size and action overlay shared by live monitor views.
 *
 * @param {object} props
 * @param {number} props.byteLength Current displayed log size in bytes.
 * @param {boolean} [props.clearArmed] Whether the optional clear action requires confirmation.
 * @param {boolean} [props.sticky] Keeps the overlay visible in a scrolling log viewport.
 * @param {() => void} props.onDownload Starts the caller-specific log download.
 * @param {() => void} [props.onClear] Handles the optional clear action.
 * @param {React.RefObject<HTMLButtonElement>} [props.clearButtonRef] Clear button ref for outside-click handling.
 * @param {boolean} [props.showClear] Shows the clear action.
 * @returns {import("react").ReactElement}
 */
export function LogOverlayActions({
  byteLength,
  clearArmed = false,
  clearButtonRef,
  onClear,
  onDownload,
  showClear = false,
  sticky = false,
}) {
  const clearButtonClassName = clearArmed
    ? "border-rose-300/70 bg-rose-700 hover:bg-rose-800"
    : "border-slate-500/50 bg-white/10 hover:bg-white/20";
  const controls = (
    <div className="flex items-center justify-end gap-2 rounded bg-slate-950/65 px-2 py-1 text-[11px] leading-4 text-slate-300 backdrop-blur-sm">
      <span className="min-w-0 truncate">
        <span className="font-medium text-slate-400">Log:</span>
        {" "}
        <strong className="font-semibold text-slate-100">{Math.round(byteLength / 1024)} KB</strong>
      </span>
      <button
        className="rounded border border-slate-500/50 bg-white/10 px-1.5 text-slate-100 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!byteLength}
        onClick={onDownload}
        type="button"
      >
        Download
      </button>
      {showClear ? (
        <button
          aria-pressed={clearArmed}
          className={`rounded border px-1.5 text-slate-100 ${clearButtonClassName}`}
          onClick={onClear}
          ref={clearButtonRef}
          type="button"
        >
          Clear
        </button>
      ) : null}
    </div>
  );

  if (sticky) {
    return <div className="sticky top-0 z-10 ml-auto h-0 w-fit">{controls}</div>;
  }

  return <div className="absolute right-5 top-2 max-w-[calc(100%-2rem)]">{controls}</div>;
}
