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

const PAIRING_STEPS = [
  "X and Y are polled separately, so their readings arrive at slightly different times.",
  "When one axis gets a new reading, the chart waits up to the pair timeout for the other axis.",
  "If the other axis reports in time, the point uses both new readings.",
  "If it doesn't, the point uses the new reading and the last known value of the other axis.",
  "Nothing is drawn until both axes have reported at least once.",
];

/**
 * Help button that explains the X-Y chart pair timeout setting.
 *
 * @returns {import("react").ReactElement}
 */
export function XyPairTimeoutInfoButton() {
  const [open, setOpen] = useState(false);
  const dialogRef = useModalDialog(open, () => setOpen(false));

  return (
    <>
      <button
        aria-label="What is pair timeout?"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-700"
        onClick={() => setOpen(true)}
        onPointerDown={(event) => event.stopPropagation()}
        type="button"
      >
        <CircleHelp className="h-3.5 w-3.5" />
      </button>

      {open ? (
        <div
          aria-label="Pair timeout"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 px-4 py-6"
          onPointerDown={(event) => event.stopPropagation()}
          role="dialog"
          ref={dialogRef}
        >
          <div className="grid w-full max-w-md gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex min-w-0 items-start justify-between gap-4">
              <h3 className="text-lg font-semibold text-slate-950">Pair timeout</h3>
              <button
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <p className="text-sm text-slate-700">
              How long the chart waits for the matching X or Y reading before it draws a point.
            </p>

            <div className="grid gap-2">
              <h4 className="text-sm font-semibold text-slate-900">How points are paired</h4>
              <ul className="grid gap-1 pl-5 text-sm text-slate-700">
                {PAIRING_STEPS.map((step) => (
                  <li key={step} className="list-disc">
                    {step}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-1">
              <h4 className="text-sm font-semibold text-slate-900">Choosing a value</h4>
              <p className="text-sm text-slate-700">
                Keep it shorter than one poll interval (1000 ms at 1 Hz, 200 ms at 5 Hz). If it is longer and one
                axis stops replying, some readings from the other axis are skipped. Allowed range: 50 to 10000 ms.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
