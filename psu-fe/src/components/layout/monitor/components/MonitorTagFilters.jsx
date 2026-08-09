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
 * Displays available monitor tags and the active tag filters.
 *
 * @param {object} props
 * @param {object} props.filters - Tag filter values and mutation callbacks.
 * @returns {import("react").ReactElement}
 */
export function MonitorTagFilters({ filters }) {
  const hasAvailableTags = filters.available.length > 0;

  function handleTagAdd(event) {
    filters.add(event.currentTarget.value);
  }

  function handleTagRemove(event) {
    filters.remove(event.currentTarget.value);
  }

  if (!hasAvailableTags) {
    return (
      <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] leading-5 text-slate-600">
        <div className="flex items-center text-slate-400">
          <span className="mr-1 font-medium text-slate-500">Tags:</span>
          None
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] leading-5 text-slate-600">
      <div className="grid gap-1">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 font-medium text-slate-500">Available:</span>
          {filters.visible.length ? (
            filters.visible.map((tag) => (
              <button
                className="rounded border border-slate-200 bg-white px-1.5 text-slate-700 hover:bg-slate-100"
                key={tag}
                onClick={handleTagAdd}
                type="button"
                value={tag}
              >
                {tag}
              </button>
            ))
          ) : (
            <span className="text-slate-400">None</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 font-medium text-slate-500">Selected:</span>
          {filters.selected.length ? (
            <>
              {filters.selected.map((tag) => (
                <span
                  className="inline-flex items-center gap-1 rounded border border-teal-200 bg-white px-1.5 text-teal-800"
                  key={tag}
                >
                  {tag}
                  <button
                    aria-label={`Remove ${tag} filter`}
                    className="text-teal-700 hover:text-teal-950"
                    onClick={handleTagRemove}
                    type="button"
                    value={tag}
                  >
                    x
                  </button>
                </span>
              ))}
              <button
                className="ml-1 rounded border border-slate-200 bg-white px-1.5 text-slate-600 hover:bg-slate-100"
                onClick={filters.clear}
                type="button"
              >
                All
              </button>
            </>
          ) : (
            <span className="text-slate-400">All</span>
          )}
        </div>
      </div>
    </div>
  );
}
