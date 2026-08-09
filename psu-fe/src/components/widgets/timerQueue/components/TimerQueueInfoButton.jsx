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
import { CircleHelp } from "lucide-react";
import { useState } from "react";
import { useModalDialog } from "../../../layout/hooks/useModalDialog.js";

const TIMER_QUEUE_INFO_TEXT =
  "Use one timer widget per device/channel. Multiple widgets targeting the same queue are unsupported.";

export function TimerQueueInfoButton() {
  const [open, setOpen] = useState(false);
  const dialogRef = useModalDialog(open, () => setOpen(false));

  return (
    <>
      <button
        aria-label="Timer queue info"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => setOpen(true)}
        type="button"
      >
        <CircleHelp className="h-4 w-4" />
        <span className="sr-only">Info</span>
      </button>

      {open ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6"
          onPointerDown={(event) => event.stopPropagation()}
          role="dialog"
          ref={dialogRef}
        >
          <div className="grid w-full max-w-sm gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex min-w-0 items-start justify-between gap-4">
              <h3 className="text-lg font-semibold text-slate-950">Timer Queue Info</h3>
              <button
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <p className="text-sm text-slate-700">{TIMER_QUEUE_INFO_TEXT}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
