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
import { Download, FileCode2, FilePlus2, FolderOpen, LoaderCircle, Play, Save, Settings, SquareStack, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ScriptEditor } from "../widgets/scriptEditor/components/ScriptEditor.jsx";
import { EMPTY_SCRIPT_SOURCE, fileNameToTitle, normaliseScript, parseTags, scriptFileName, shortScriptId, validateWrappedScript } from "../widgets/scriptEditor/utils/scriptDocument.js";
import { useModalDialog } from "../layout/hooks/useModalDialog.js";
import { IdeMenuBar } from "./IdeMenuBar.jsx";
import { sortBuiltinTemplates } from "../widgets/scriptSources/utils/sortBuiltinTemplates.js";

/** Full-window editor shell for the document selected by the IDE workspace. */
export function IdeScriptEditor({ bottomPanel, document: scriptDocument, loadBindings, loadBuiltinDetail, loadBuiltinTemplates, onClose, onOpenDocument, onOpenPopup, onPersist, onRun, onTagsReload }) {
  const initial = useMemo(() => normaliseScript(scriptDocument), [scriptDocument]);
  const [name, setName] = useState(initial.name);
  const [sourceCode, setSourceCode] = useState(initial.sourceCode);
  const [savedId, setSavedId] = useState(scriptDocument?.id || null);
  const [baseline, setBaseline] = useState(initial);
  const [bindings, setBindings] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const sourceError = validateWrappedScript(sourceCode);
  const dirty = name !== baseline.name || sourceCode !== baseline.sourceCode;
  const canSave = Boolean(name.trim() && sourceCode.trim() && !sourceError);

  useEffect(() => {
    const next = normaliseScript(scriptDocument);
    if (!dirty) {
      setName(next.name);
      setSourceCode(next.sourceCode);
      setSavedId(scriptDocument?.id || null);
      setBaseline(next);
      setError("");
    } else if (scriptDocument?.id !== savedId) {
      setPendingAction(() => () => replaceDocument(scriptDocument));
    }
  }, [scriptDocument]);

  useEffect(() => {
    let active = true;
    loadBuiltinTemplates().then((page) => active && setTemplates(sortBuiltinTemplates(page.items || []))).catch((requestError) => active && setError(requestError.message || "Could not load built-in scripts."));
    loadBindings().then((response) => active && setBindings(response.items || [])).catch(() => active && setError("Runner completions are unavailable. JavaScript editing is still available."));
    return () => { active = false; };
  }, [loadBindings, loadBuiltinTemplates]);

  useEffect(() => {
    function saveShortcut(event) {
      if ((!event.ctrlKey && !event.metaKey) || event.altKey || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      void save();
    }
    document.addEventListener("keydown", saveShortcut);
    return () => document.removeEventListener("keydown", saveShortcut);
  }, [name, sourceCode, savedId]);

  function replaceDocument(nextDocument = {}) {
    const next = normaliseScript(nextDocument);
    setName(next.name);
    setSourceCode(next.sourceCode);
    setSavedId(nextDocument.id || null);
    setBaseline(next);
    setError("");
  }

  function requestAction(action) {
    if (dirty) setPendingAction(() => action);
    else action();
  }

  function createDocument() {
    requestAction(() => {
      onOpenDocument({});
      replaceDocument({});
    });
  }

  async function save(forceCreate = false) {
    if (!canSave || saving) return;
    setSaving(true);
    setError("");
    try {
      const saved = await onPersist({ name: name.trim(), sourceCode, tags: baseline.tags || [] }, forceCreate ? null : savedId, forceCreate);
      const next = normaliseScript(saved);
      setSavedId(saved.id);
      setBaseline(next);
      setName(next.name);
      setSourceCode(next.sourceCode);
      if (!savedId || forceCreate) await onTagsReload?.();
    } catch (requestError) {
      setError(requestError.message || "Could not save script.");
    } finally {
      setSaving(false);
    }
  }

  async function run() {
    if (!canSave || running) return;
    setRunning(true);
    setError("");
    try {
      const result = await onRun({ name: name.trim(), sourceCode, tags: baseline.tags || [] }, savedId);
      replaceDocument(result.script);
      await onTagsReload?.();
    } catch (requestError) {
      setError(requestError.message || "Could not save and run script.");
    } finally {
      setRunning(false);
    }
  }

  async function loadTemplate(templateId) {
    setLoadingTemplate(true);
    try {
      const template = await loadBuiltinDetail(templateId);
      // Built-ins are read-only templates, not saved user documents. Running one must create a user source.
      requestAction(() => replaceDocument({ ...template, id: null }));
    } catch (requestError) {
      setError(requestError.message || "Could not load built-in script.");
    } finally {
      setLoadingTemplate(false);
    }
  }

  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const contents = await file.text();
    requestAction(() => replaceDocument({ name: fileNameToTitle(file.name), sourceCode: contents }));
  }

  function exportFile() {
    const filename = `${(name.trim() || "script").replace(/[^a-z0-9_-]+/gi, "-")}.js`;
    const url = URL.createObjectURL(new Blob([sourceCode], { type: "text/javascript" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  const menuItems = [
    { id: "file", label: "File", mnemonic: "f", globalMnemonic: true, children: [
      { id: "new", label: "New File", mnemonic: "w", globalMnemonic: true, icon: <FilePlus2 className="h-4 w-4" />, action: createDocument },
      { id: "open", label: "Open", mnemonic: "o", globalMnemonic: true, icon: <FolderOpen className="h-4 w-4" />, action: () => onOpenPopup("sources") },
      { type: "separator" },
      { id: "save", label: "Save", mnemonic: "v", globalMnemonic: true, icon: <Save className="h-4 w-4" />, action: () => save(false) },
      { id: "save-as", label: "Save As", mnemonic: "a", globalMnemonic: true, icon: <Save className="h-4 w-4" />, action: () => save(true) },
      { type: "separator" },
      { id: "import", label: "Import", mnemonic: "i", globalMnemonic: true, icon: <Download className="h-4 w-4" />, action: () => fileInputRef.current?.click() },
      { id: "export", label: "Export", mnemonic: "e", globalMnemonic: true, icon: <Upload className="h-4 w-4" />, action: exportFile },
      { type: "separator" },
      { id: "templates", label: "Load Template", mnemonic: "l", globalMnemonic: true, icon: <FileCode2 className="h-4 w-4" />, disabled: loadingTemplate, children: templates.map((template) => ({ id: `template-${template.id}`, label: template.name, action: () => loadTemplate(template.id) })) },
      { type: "separator" },
      { id: "exit", label: "Exit", mnemonic: "x", globalMnemonic: true, icon: <X className="h-4 w-4" />, action: () => requestAction(onClose) },
    ] },
    { id: "run", label: "Run", mnemonic: "n", globalMnemonic: true, icon: running ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />, tone: "primary", disabled: !canSave || running, action: run },
    { id: "scripts", label: "Scripts", mnemonic: "c", globalMnemonic: true, icon: <SquareStack className="h-4 w-4" />, children: [{ id: "sources", label: "Sources", mnemonic: "o", action: () => onOpenPopup("sources") }, { id: "tasks", label: "Tasks", mnemonic: "t", globalMnemonic: true, action: () => onOpenPopup("tasks") }] },
    { id: "settings", label: "Settings", mnemonic: "s", globalMnemonic: true, icon: <Settings className="h-4 w-4" />, children: [{ id: "backend", label: "Backend", mnemonic: "b", globalMnemonic: true, action: () => onOpenPopup("backend") }, { id: "devices", label: "Devices", mnemonic: "d", globalMnemonic: true, action: () => onOpenPopup("devices") }] },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className="flex h-14 shrink-0 items-center border-b border-slate-200 px-4">
        <h1 className="mr-3 text-sm font-semibold text-slate-900">IDE</h1>
        <IdeMenuBar items={menuItems} />
        <button aria-label="Close IDE" className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => requestAction(onClose)} type="button"><X className="h-5 w-5" /></button>
      </header>
      <main className="flex min-h-0 flex-1 flex-col p-4">
        <div className="shrink-0 rounded-t-md border border-slate-300 border-b-0 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">{savedId ? shortScriptId(savedId) : "*"} · {scriptFileName(name)}</div>
        <ScriptEditor bindings={bindings} flushTop onChange={setSourceCode} value={sourceCode || EMPTY_SCRIPT_SOURCE} />
        {sourceError ? <p className="mt-2 text-xs text-rose-600">{sourceError}</p> : null}
        {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
      </main>
      {bottomPanel}
      <input accept=".js,text/javascript,application/javascript" aria-label="Import JavaScript File" className="hidden" onChange={importFile} ref={fileInputRef} type="file" />
      {pendingAction ? <DiscardChangesDialog onCancel={() => setPendingAction(null)} onDiscard={() => { const action = pendingAction; setPendingAction(null); action(); }} /> : null}
    </div>
  );
}

function DiscardChangesDialog({ onCancel, onDiscard }) {
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
          <button className="control-standard bg-rose-600 px-3 font-medium text-white" onClick={onDiscard} type="button">
            Proceed
          </button>
        </div>
      </div>
    </div>
  );
}
