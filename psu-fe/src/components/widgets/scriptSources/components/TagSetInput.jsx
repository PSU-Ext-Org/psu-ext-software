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
import { useId, useMemo, useState } from "react";

/** Accessible chip input with optional backend-provided tag suggestions. */
export function TagSetInput({ disabled = false, hideLabel = false, label = "Tags", onChange, onSubmit, placeholder, suggestions = [], value = [] }) {
  const [draft, setDraft] = useState("");
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const suggestionId = useId();
  const matches = useMemo(() => {
    const prefix = draft.trim().toLocaleLowerCase();
    if (!prefix) return [];
    const selected = new Set(value.map((tag) => tag.toLocaleLowerCase()));
    return suggestions.filter((tag) => tag.toLocaleLowerCase().startsWith(prefix) && !selected.has(tag.toLocaleLowerCase()));
  }, [draft, suggestions, value]);

  function add(valueToAdd = draft) {
    const tag = valueToAdd.trim();
    if (!tag || value.some((selected) => selected.toLocaleLowerCase() === tag.toLocaleLowerCase())) return value;
    const next = [...value, tag];
    onChange(next);
    setDraft("");
    setActiveSuggestion(-1);
    return next;
  }

  function remove(tag) {
    onChange(value.filter((selected) => selected !== tag));
  }

  function handleChange(event) {
    const next = event.target.value;
    if (next.endsWith(",")) {
      add(next.slice(0, -1));
      return;
    }
    setDraft(next);
    setActiveSuggestion(-1);
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowDown" && matches.length) {
      event.preventDefault();
      setActiveSuggestion((current) => (current + 1) % matches.length);
    } else if (event.key === "ArrowUp" && matches.length) {
      event.preventDefault();
      setActiveSuggestion((current) => (current <= 0 ? matches.length - 1 : current - 1));
    } else if (event.key === "Escape") {
      setActiveSuggestion(-1);
      setDraft("");
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeSuggestion >= 0) {
        add(matches[activeSuggestion]);
      } else {
        const next = add();
        onSubmit?.(next);
      }
    } else if (event.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700">
      <span className={hideLabel ? "sr-only" : ""}>{label}</span>
      <div className="relative">
        <div className={`control-standard flex h-auto min-h-8 w-full min-w-0 flex-wrap items-center gap-1 border border-slate-300 bg-white py-0 text-slate-950 outline-none focus-within:border-teal-700 ${disabled ? "cursor-not-allowed bg-slate-100 text-slate-500" : ""}`}>
          {value.map((tag) => <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700" key={tag}>{tag}<button aria-label={`Remove tag ${tag}`} className="text-slate-500 hover:text-slate-900 disabled:opacity-50" disabled={disabled} onClick={() => remove(tag)} type="button">×</button></span>)}
          <input aria-activedescendant={activeSuggestion >= 0 ? `${suggestionId}-suggestion-${activeSuggestion}` : undefined} aria-autocomplete="list" aria-controls={`${suggestionId}-suggestions`} aria-expanded={matches.length > 0} aria-label={label} className="h-8 min-w-24 flex-1 border-0 bg-transparent p-0 text-sm text-slate-950 outline-none" disabled={disabled} onChange={handleChange} onKeyDown={handleKeyDown} placeholder={value.length ? "Add tag" : placeholder} value={draft} />
        </div>
        {matches.length ? <ul className="absolute z-20 mt-1 max-h-44 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg" id={`${suggestionId}-suggestions`} role="listbox">{matches.map((tag, index) => <li key={tag}><button aria-selected={index === activeSuggestion} className={`block w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 ${index === activeSuggestion ? "bg-teal-50" : ""}`} id={`${suggestionId}-suggestion-${index}`} onClick={() => add(tag)} role="option" type="button">{tag}</button></li>)}</ul> : null}
      </div>
    </label>
  );
}
