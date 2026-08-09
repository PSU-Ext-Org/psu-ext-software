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
 * Feature-local tab list for Script Runner console output.
 *
 * @param {object} props
 * @param {string} props.activeId - Identifier of the visible console tab.
 * @param {(id: string) => void} props.onSelect - Selects a console tab.
 * @param {Array<{id: string, label: string}>} props.tabs - Available console tabs.
 * @returns {import("react").ReactElement}
 */
export function TaskConsoleTabs({ activeId, onSelect, tabs }) {
  return (
    <div className="flex shrink-0 border-b border-slate-200 px-2" role="tablist">
      {tabs.map((tab) => (
        <button
          aria-selected={tab.id === activeId}
          className={`border-b-2 px-3 py-1.5 text-xs font-medium ${tab.id === activeId ? "border-teal-700 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          role="tab"
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
