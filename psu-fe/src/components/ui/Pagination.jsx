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
 * Compact shared pagination controls for widget tables.
 *
 * @param {{label: string, canPrevious: boolean, canNext: boolean, onPrevious: Function, onNext: Function}} props
 * @returns {import("react").ReactElement}
 */
export function Pagination({ label, canPrevious, canNext, onPrevious, onNext }) {
  return (
    <div className="flex items-center justify-end gap-3 text-sm text-slate-600">
      <span>{label}</span>
      <button className="control-standard border border-slate-200 bg-white px-3 font-medium hover:bg-slate-50 disabled:opacity-50" disabled={!canPrevious} onClick={onPrevious} type="button">Previous</button>
      <button className="control-standard border border-slate-200 bg-white px-3 font-medium hover:bg-slate-50 disabled:opacity-50" disabled={!canNext} onClick={onNext} type="button">Next</button>
    </div>
  );
}
