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
const PAGE_HEADING_Y_PADDING = "1.2rem";

/**
 * Shared compact heading row used at the top of app pages.
 *
 * @param {object} props
 * @param {import("react").ReactNode} [props.actions] - Optional right-aligned page actions.
 * @returns {import("react").ReactElement}
 */
export function PageHeading({ actions = null }) {
  return (
    <section
      className="mx-auto flex min-h-12 max-w-6xl flex-col gap-2 px-6 py-[var(--page-heading-y)] md:flex-row md:items-center md:justify-between"
      style={{ "--page-heading-y": PAGE_HEADING_Y_PADDING }}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-xs font-semibold uppercase text-teal-700">
          PSU-EXT Operator Interface
        </p>
        <p className="text-sm text-slate-600">
          Control, telemetry etc.
        </p>
      </div>

      {actions ? <div className="flex shrink-0 items-center">{actions}</div> : null}
    </section>
  );
}
