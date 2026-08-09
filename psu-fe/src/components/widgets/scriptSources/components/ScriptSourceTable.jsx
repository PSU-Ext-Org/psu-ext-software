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
 * Fixed-column table for user-managed Script Runner sources.
 *
 * @param {object} props
 * @param {object[]} props.items Script summary rows.
 * @param {(id: string, selected: boolean) => void} props.onSelectionChange Updates a row selection.
 * @param {(script: object) => void} [props.onOpen] Opens one script source.
 * @param {Set<string>} props.selectedIds Selected script IDs.
 * @param {string} [props.title] Optional table title.
 * @returns {import("react").ReactElement}
 */
export function ScriptSourceTable({ items, onOpen, selectedIds, title, onSelectionChange }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      {title ? <h3 className="text-sm font-semibold text-slate-800">{title}</h3> : null}
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-slate-200">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-16" />
            <col className="w-20" />
            <col className="w-64" />
            <col className="w-96" />
            <col className="w-44" />
          </colgroup>
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-center">Select</th>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Tags</th>
              <th className="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {!items.length ? (
              <tr>
                <td className="px-3 py-4 text-center text-slate-400" colSpan={5}>No scripts found.</td>
              </tr>
            ) : items.map((script) => (
              <tr className={`border-t border-slate-100 text-slate-700 ${onOpen ? "cursor-pointer hover:bg-slate-50" : ""}`} key={script.id} onClick={() => onOpen?.(script)}>
                <td className="px-3 py-2 text-center">
                  <input
                    aria-label={`Select script ${script.name}`}
                    checked={selectedIds.has(script.id)}
                    onChange={(event) => onSelectionChange(script.id, event.target.checked)}
                    onClick={(event) => event.stopPropagation()}
                    type="checkbox"
                  />
                </td>
                <td className="truncate px-3 py-2 font-mono" title={script.id}>{script.id.slice(0, 5)}</td>
                <td className="truncate px-3 py-2" title={script.name}>{script.name}</td>
                <td className="px-3 py-2">
                  <TagList tags={script.tags || []} />
                </td>
                <td className="whitespace-nowrap px-3 py-2">{formatDate(script.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TagList({ tags }) {
  if (!tags.length) return "-";
  return (
    <div className="flex h-5 items-center gap-1 overflow-hidden whitespace-nowrap" title={tags.join(", ")}>
      {tags.map((tag) => (
        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600" key={tag}>
          {tag}
        </span>
      ))}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}
