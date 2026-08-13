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
import { useModalDialog } from "../../layout/hooks/useModalDialog.js";

/** Confirms navigation that would discard unsaved editor changes. */
export function IdeDiscardChangesDialog({ onCancel, onDiscard }) {
  const dialogRef = useModalDialog(true, onCancel);

  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-slate-950/25 p-4">
      <div
        aria-modal="true"
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-xl"
        ref={dialogRef}
        role="dialog"
      >
        <h2 className="font-semibold text-slate-900">Discard unsaved changes?</h2>
        <p className="mt-2 text-sm text-slate-600">Your current script changes will be lost.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="control-standard border border-slate-300 bg-white px-3 font-medium text-slate-700"
            data-autofocus
            onClick={onCancel}
            type="button"
          >
            Continue Editing
          </button>
          <button
            className="control-standard bg-rose-600 px-3 font-medium text-white"
            onClick={onDiscard}
            type="button"
          >
            Proceed
          </button>
        </div>
      </div>
    </div>
  );
}
