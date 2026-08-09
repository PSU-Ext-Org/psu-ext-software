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
import { ChevronDown, Pencil, Play, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useScriptRunnerHttp } from "../../../../connection/http-script/ScriptRunnerHttpContext.jsx";
import { Field } from "../../../forms/Field.jsx";
import { Modal } from "../../../layout/dialogs/Modal.jsx";
import { Pagination } from "../../../ui/Pagination.jsx";
import { ScriptSourceDialog } from "./ScriptSourceDialog.jsx";
import { ScriptSourceTable } from "./ScriptSourceTable.jsx";
import { TagSetInput } from "./TagSetInput.jsx";
import { useScriptSources } from "../hooks/useScriptSources.js";
import { useScriptTagHints } from "../hooks/useScriptTagHints.js";

const NEW_SCRIPT_EVENT = "psu-ext-open-script-source-new";
const DELETE_SCRIPTS_EVENT = "psu-ext-open-script-source-delete";
const RUN_SCRIPTS_EVENT = "psu-ext-run-script-sources";
const EDIT_SCRIPT_EVENT = "psu-ext-open-script-source-edit";
const SCRIPT_SELECTION_EVENT = "psu-ext-script-source-selection";

/**
 * Header actions for creating, running, and deleting user scripts.
 *
 * @returns {import("react").ReactElement}
 */
export function ScriptSourcesActions() {
  const [open, setOpen] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const menuRef = useRef(null);

  useEffect(() => {
    function updateSelection(event) {
      setSelectedCount(event.detail);
    }
    window.addEventListener(SCRIPT_SELECTION_EVENT, updateSelection);
    return () => window.removeEventListener(SCRIPT_SELECTION_EVENT, updateSelection);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    function closeOnOutsidePointerDown(event) {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="control-standard inline-flex items-center gap-2 bg-teal-700 px-3 font-medium text-white hover:bg-teal-800"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        Actions
        <ChevronDown className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 z-10 mt-1 grid min-w-28 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg" role="menu">
          <button
            className="inline-flex items-center gap-2 px-3 py-1.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new Event(NEW_SCRIPT_EVENT));
            }}
            role="menuitem"
            type="button"
          >
            <Plus className="h-4 w-4" />
            New
          </button>
          <button
            className="inline-flex items-center gap-2 px-3 py-1.5 text-left text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-50"
            disabled={!selectedCount}
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new Event(RUN_SCRIPTS_EVENT));
            }}
            role="menuitem"
            type="button"
          >
            <Play className="h-4 w-4" />
            Run
          </button>
          <button
            className="inline-flex items-center gap-2 px-3 py-1.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            disabled={selectedCount !== 1}
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new Event(EDIT_SCRIPT_EVENT));
            }}
            role="menuitem"
            type="button"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          <button
            className="inline-flex items-center gap-2 px-3 py-1.5 text-left text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            disabled={!selectedCount}
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new Event(DELETE_SCRIPTS_EVENT));
            }}
            role="menuitem"
            type="button"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Script Runner user source-catalogue widget.
 *
 * @returns {import("react").ReactElement}
 */
export function ScriptSourcesWidget({ actions, onNewScript, onOpenScript }) {
  const { scriptBindingApiUrl, scriptSourceApiUrl, scriptTaskApiUrl } = useScriptRunnerHttp();
  const [draftFilters, setDraftFilters] = useState({ name: "", tags: [] });
  const [filters, setFilters] = useState({ name: "", tags: [] });
  const [modal, setModal] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [dialogError, setDialogError] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const sources = useScriptSources(scriptSourceApiUrl, filters);
  const tagHints = useScriptTagHints(scriptSourceApiUrl, true);

  const sourceError = sources.userError;
  const customPageLabel = useMemo(() => {
    if (!sources.user.total) return "No custom scripts";
    return `${sources.user.offset + 1}–${Math.min(sources.user.offset + sources.user.items.length, sources.user.total)} of ${sources.user.total}`;
  }, [sources.user]);

  function applyFilters(tags = draftFilters.tags) {
    setFilters({ name: draftFilters.name, tags });
  }

  function resetFilters() {
    const next = { name: "", tags: [] };
    setDraftFilters(next);
    setFilters({ name: "", tags: [] });
  }

  function setSelected(id, selected) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function openDeleteSelected() {
    const scripts = sources.user.items.filter((script) => selectedIds.has(script.id));
    if (scripts.length) setModal({ mode: "delete", scripts });
  }

  function openSelectedForEdit() {
    const script = sources.user.items.find((item) => selectedIds.has(item.id));
    if (script) openEdit(script);
  }

  async function runSelected() {
    const scripts = sources.user.items.filter((script) => selectedIds.has(script.id));
    if (!scripts.length) return;
    setDialogError("");
    setLoadingDetail(true);
    try {
      await Promise.all(scripts.map(async (script) => {
        const detail = await sources.getDetail("user", script.id);
        const response = await fetch(scriptTaskApiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: detail.name, source: detail.sourceCode }),
        });
        if (!response.ok) {
          const payload = await readResponse(response);
          throw new Error(payload?.message || `Could not run ${script.name}.`);
        }
      }));
      setSelectedIds(new Set());
    } catch (error) {
      setDialogError(error.message || "Could not start script task.");
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(SCRIPT_SELECTION_EVENT, { detail: selectedIds.size }));
  }, [selectedIds]);

  async function openEdit(summary) {
    setDialogError("");
    setLoadingDetail(true);
    try {
      const detail = await sources.getDetail("user", summary.id);
      if (onOpenScript) {
        onOpenScript(detail);
        return;
      }
      setModal({ mode: "edit", script: detail });
    } catch (error) {
      setDialogError(error.message || "Could not load script source.");
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex min-w-0 items-end gap-3">
        <ScriptFilters
          draftFilters={draftFilters}
          hintError={tagHints.error}
          hints={tagHints.tags}
          onApply={applyFilters}
          onChange={setDraftFilters}
          onReset={resetFilters}
        />
        {actions ? <div className="ml-auto shrink-0">{actions}</div> : null}
      </div>
      {sourceError ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <span>Script Runner unavailable at {scriptSourceApiUrl}: {sourceError}</span>
          <button className="control-standard border border-rose-200 bg-white px-3 font-medium" onClick={sources.refresh} type="button">Retry</button>
        </div>
      ) : null}
      {dialogError ? <p className="text-sm text-rose-700">{dialogError}</p> : null}
      {loadingDetail ? <p className="text-sm text-slate-500">Loading script source…</p> : null}
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <ScriptSourceTable
          items={sources.user.items}
          onOpen={openEdit}
          onSelectionChange={setSelected}
          selectedIds={selectedIds}
        />
        <Pagination
          label={customPageLabel}
          onNext={() => sources.setUserOffset(sources.user.offset + sources.user.limit)}
          onPrevious={() => sources.setUserOffset(Math.max(0, sources.user.offset - sources.user.limit))}
          canNext={sources.user.offset + sources.user.items.length < sources.user.total}
          canPrevious={sources.user.offset > 0}
        />
      </div>
      {modal?.mode === "create" ? <ScriptSourceDialog loadBindings={() => fetchBindings(scriptBindingApiUrl)} loadBuiltinDetail={(id) => sources.getDetail("builtin", id)} loadBuiltinTemplates={sources.listBuiltinTemplates} mode="create" onClose={() => setModal(null)} onRun={(script, savedId) => saveAndRun(sources, scriptTaskApiUrl, script, savedId)} onSubmit={sources.createUser} onTagsReload={tagHints.reload} tagHints={tagHints.tags} tagHintsError={tagHints.error} tagHintsLoading={tagHints.loading} /> : null}
      {modal?.mode === "edit" ? <ScriptSourceDialog initialScript={modal.script} loadBindings={() => fetchBindings(scriptBindingApiUrl)} loadBuiltinDetail={(id) => sources.getDetail("builtin", id)} loadBuiltinTemplates={sources.listBuiltinTemplates} mode="edit" onClose={() => setModal(null)} onRun={(script) => saveAndRun(sources, scriptTaskApiUrl, script, modal.script.id)} onSubmit={(script) => sources.replaceUser(modal.script.id, script)} onTagsReload={tagHints.reload} tagHints={tagHints.tags} tagHintsError={tagHints.error} tagHintsLoading={tagHints.loading} /> : null}
      {modal?.mode === "delete" ? <DeleteScriptModal scripts={modal.scripts} onClose={() => setModal(null)} onDelete={sources.deleteUser} onDeleted={() => setSelectedIds(new Set())} /> : null}
      <ScriptSourceActionListener
        onDelete={openDeleteSelected}
        onEdit={openSelectedForEdit}
        onNew={() => onNewScript ? onNewScript() : setModal({ mode: "create" })}
        onRun={runSelected}
      />
    </div>
  );
}

function ScriptFilters({ draftFilters, hintError, hints, onChange, onApply, onReset }) {
  return (
    <form className="grid min-w-0 flex-1 grid-cols-[minmax(14rem,1fr)_minmax(14rem,1fr)_auto_auto] items-end gap-3" onSubmit={(event) => { event.preventDefault(); onApply(); }}>
      <Field label="Name" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onApply(); } }} placeholder="Filter by name" value={draftFilters.name} onChange={(name) => onChange((current) => ({ ...current, name }))} />
      <div><TagSetInput label="Tags" onChange={(tags) => onChange((current) => ({ ...current, tags }))} onSubmit={onApply} placeholder="Filter by tag" suggestions={hints} value={draftFilters.tags} />{hintError ? <p className="mt-1 text-xs text-amber-700">Tag suggestions are unavailable.</p> : null}</div>
      <button className="control-standard inline-flex w-20 items-center justify-center border border-slate-300 bg-white px-2 font-medium leading-none text-slate-700 hover:bg-slate-50" type="submit">Apply</button>
      <button aria-label="Reset filters" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" onClick={onReset} title="Reset filters" type="button"><RotateCcw className="h-4 w-4" /></button>
    </form>
  );
}

function DeleteScriptModal({ scripts, onDelete, onClose, onDeleted }) {
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function confirm() {
    setDeleting(true);
    try {
      await Promise.all(scripts.map((script) => onDelete(script.id)));
      onDeleted();
      onClose();
    } catch (requestError) {
      setError(requestError.message || "Could not delete script.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal title={scripts.length === 1 ? "Delete Script" : "Delete Scripts"} onClose={onClose}>
      <div className="grid gap-4">
        <p>
          Delete {scripts.length === 1 ? "script" : `${scripts.length} scripts`}
          {scripts.length === 1 ? <> <strong>{scripts[0].name}</strong></> : ""}?
        </p>
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        <button className="control-standard bg-rose-600 px-3 font-medium text-white disabled:opacity-50" disabled={deleting} onClick={confirm} type="button">Delete</button>
      </div>
    </Modal>
  );
}

function ScriptSourceActionListener({ onNew, onDelete, onEdit, onRun }) {
  useEffect(() => {
    window.addEventListener(NEW_SCRIPT_EVENT, onNew);
    window.addEventListener(DELETE_SCRIPTS_EVENT, onDelete);
    window.addEventListener(EDIT_SCRIPT_EVENT, onEdit);
    window.addEventListener(RUN_SCRIPTS_EVENT, onRun);
    return () => {
      window.removeEventListener(NEW_SCRIPT_EVENT, onNew);
      window.removeEventListener(DELETE_SCRIPTS_EVENT, onDelete);
      window.removeEventListener(EDIT_SCRIPT_EVENT, onEdit);
      window.removeEventListener(RUN_SCRIPTS_EVENT, onRun);
    };
  }, [onDelete, onEdit, onNew, onRun]);
  return null;
}

async function readResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { message: text };
  }
}

async function fetchBindings(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const payload = await readResponse(response);
  if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
  return payload;
}

async function saveAndRun(sources, taskApiUrl, script, savedId) {
  const saved = savedId ? await sources.replaceUser(savedId, script) : await sources.createUser(script);
  const response = await fetch(taskApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: saved.name, source: saved.sourceCode }),
  });
  const payload = await readResponse(response);
  if (!response.ok) throw new Error(payload?.message || `Could not run ${saved.name}.`);
  return { script: saved, taskId: payload.taskId };
}
