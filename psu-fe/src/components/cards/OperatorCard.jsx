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
 * Generic dashboard card used by operator pages.
 *
 * @param {object} props
 * @param {import("react").ComponentType<{className?: string}>} [props.icon] - Optional lucide icon component.
 * @param {string} props.title - Card heading.
 * @param {string} [props.text] - Supporting description text.
 * @param {import("react").ReactNode} [props.status] - Status value shown in the card footer.
 * @param {import("react").ReactNode} [props.statusAction] - Optional action shown beside the status value.
 * @param {import("react").ReactNode} [props.children] - Optional custom card body.
 * @returns {import("react").ReactElement}
 */
export function OperatorCard({ icon: Icon, title, text, status, statusAction, children }) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          {text ? <p className="min-w-0 text-sm text-slate-600">{text}</p> : null}
        </div>
        {Icon ? <Icon className="h-5 w-5 text-teal-700" /> : null}
      </div>

      {status ? (
        <div className="mt-5 flex min-w-0 items-center justify-between gap-3 rounded-md bg-slate-100 px-3 py-2 text-sm">
          <span className="shrink-0 text-slate-600">Status</span>
          <span className="flex min-w-0 items-center gap-2">
            <strong className="min-w-0 truncate text-right">{status}</strong>
            {statusAction}
          </span>
        </div>
      ) : null}

      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}
