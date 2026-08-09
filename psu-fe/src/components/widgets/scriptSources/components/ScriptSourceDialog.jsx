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
import { ChevronDown, ChevronRight, FileCode2, FolderOpen, LoaderCircle, Play, Save, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Field } from "../../../forms/Field.jsx";
import { Modal } from "../../../layout/dialogs/Modal.jsx";
import { useModalDialog } from "../../../layout/hooks/useModalDialog.js";
import { ScriptEditor } from "../../scriptEditor/components/ScriptEditor.jsx";
import { EMPTY_SCRIPT_SOURCE, fileNameToTitle, normaliseScript, parseTags, validateWrappedScript } from "../../scriptEditor/utils/scriptDocument.js";
import { TagSetInput } from "./TagSetInput.jsx";
import { sortBuiltinTemplates } from "../utils/sortBuiltinTemplates.js";

/**
 * Modal for creating or editing a Script Runner source from the generic source catalogue.
 */
export function ScriptSourceDialog({
  mode,
  initialScript = {},
  loadBindings,
  loadBuiltinDetail,
  loadBuiltinTemplates,
  onClose,
  onRun,
  onSaved,
  onSubmit,
  onTagsLoad,
  onTagsReload,
  tagHints = [],
  tagHintsError = "",
  tagHintsLoading = false,
}) {
  const initial = useMemo(() => normaliseScript(initialScript), [initialScript]);
  const [name, setName] = useState(initial.name);
  const [tags, setTags] = useState(initial.tags);
  const [sourceCode, setSourceCode] = useState(initial.sourceCode || EMPTY_SCRIPT_SOURCE);
  const [savedBaseline, setSavedBaseline] = useState(initial);
  const [builtinTemplates, setBuiltinTemplates] = useState([]);
  const [bindings, setBindings] = useState([]);
  const [error, setError] = useState("");
  const [bindingError, setBindingError] = useState("");
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [running, setRunning] = useState(false);
  const [savedId, setSavedId] = useState(initialScript.id || null);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [saveAs, setSaveAs] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const fileInputRef = useRef(null);
  const fileMenuRef = useRef(null);
  const fileButtonRef = useRef(null);
  const sourceError = validateWrappedScript(sourceCode);
  const dirty = name !== savedBaseline.name || !sameTags(tags, savedBaseline.tags) || sourceCode !== (savedBaseline.sourceCode || EMPTY_SCRIPT_SOURCE);
  const canSubmit = Boolean(name.trim() && sourceCode.trim() && !sourceError);

  useEffect(() => {
    let active = true;
    loadBuiltinTemplates()
      .then((page) => { if (active) setBuiltinTemplates(sortBuiltinTemplates(page.items || [])); })
      .catch((requestError) => { if (active) setError(requestError.message || "Could not load built-in scripts."); });
    loadBindings()
      .then((response) => { if (active) setBindings(response.items || []); })
      .catch(() => { if (active) setBindingError("Runner completions are unavailable. JavaScript editing is still available."); });
    return () => { active = false; };
  }, [loadBindings, loadBuiltinTemplates]);

  useEffect(() => {
    function closeFileMenu(event) {
      if (!fileMenuRef.current?.contains(event.target)) {
        setFileMenuOpen(false);
        setTemplateMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeFileMenu);
    return () => document.removeEventListener("pointerdown", closeFileMenu);
  }, []);

  useEffect(() => {
    function handleMenuMnemonic(event) {
      const key = event.key.toLowerCase();
      if (event.altKey && !event.ctrlKey && !event.metaKey && key === "f") {
        event.preventDefault();
        setFileMenuOpen(true);
        setTemplateMenuOpen(false);
        fileButtonRef.current?.focus();
      } else if (event.altKey && !event.ctrlKey && !event.metaKey && key === "s") {
        event.preventDefault();
        setFileMenuOpen(false);
        savedId ? save(false) : openSaveDialog(false);
      } else if (event.altKey && !event.ctrlKey && !event.metaKey && key === "a") {
        event.preventDefault();
        setFileMenuOpen(false);
        openSaveDialog(true);
      } else if (event.altKey && !event.ctrlKey && !event.metaKey && key === "i") {
        event.preventDefault();
        setFileMenuOpen(false);
        fileInputRef.current?.click();
      } else if (event.altKey && !event.ctrlKey && !event.metaKey && key === "e") {
        event.preventDefault();
        setFileMenuOpen(false);
        exportFile();
      } else if (event.altKey && !event.ctrlKey && !event.metaKey && key === "l") {
        event.preventDefault();
        setFileMenuOpen(true);
        setTemplateMenuOpen(true);
      } else if (fileMenuOpen && !event.altKey && !event.ctrlKey && !event.metaKey && key === "i") {
        event.preventDefault();
        setFileMenuOpen(false);
        fileInputRef.current?.click();
      } else if (fileMenuOpen && !event.altKey && !event.ctrlKey && !event.metaKey && key === "e") {
        event.preventDefault();
        setFileMenuOpen(false);
        exportFile();
      } else if (fileMenuOpen && !event.altKey && !event.ctrlKey && !event.metaKey && key === "l") {
        event.preventDefault();
        setTemplateMenuOpen(true);
      }
    }
    document.addEventListener("keydown", handleMenuMnemonic);
    return () => document.removeEventListener("keydown", handleMenuMnemonic);
  }, [fileMenuOpen, savedId]);

  function replaceContent(next, afterReplace) {
    setName(next.name);
    setTags(next.tags);
    setSourceCode(next.sourceCode);
    setError("");
    afterReplace?.();
  }

  function requestReplacement(next, afterReplace) {
    if (dirty) {
      setPendingAction(() => () => replaceContent(next, afterReplace));
      return;
    }
    replaceContent(next, afterReplace);
  }

  function requestClose() {
    if (dirty) {
      setPendingAction(() => onClose);
      return;
    }
    onClose();
  }

  async function save(forceCreate = false, submittedTags = tags) {
    if (!onSubmit || !canSubmit) return;
    const creating = forceCreate || !savedId;
    setSubmitting(true);
    setError("");
    try {
      const saved = await onSubmit({ name: name.trim(), sourceCode, tags: parseTags(submittedTags) }, forceCreate ? null : savedId, forceCreate);
      const savedScript = normaliseScript(saved || { name: name.trim(), sourceCode, tags: parseTags(submittedTags) });
      setSavedId(saved?.id || savedId);
      setTags(savedScript.tags);
      setSavedBaseline(savedScript);
      onSaved?.(saved);
      if (creating) await onTagsReload?.();
      setMetadataOpen(false);
      onClose();
      return saved;
    } catch (requestError) {
      setError(requestError.message || "Could not save script.");
    } finally {
      setSubmitting(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    save(false);
  }

  function openSaveDialog(forceCreate) {
    setSaveAs(forceCreate);
    setMetadataOpen(true);
    void onTagsLoad?.();
  }

  async function run() {
    if (!onRun || !canSubmit) return;
    const creating = !savedId;
    setRunning(true);
    setError("");
    try {
      const result = await onRun({ name: name.trim(), sourceCode, tags: parseTags(tags) }, savedId);
      setSavedId(result.script.id);
      onSaved?.(result.script);
      if (creating) await onTagsReload?.();
    } catch (requestError) {
      setError(requestError.message || "Could not save and run script.");
    } finally {
      setRunning(false);
    }
  }

  async function loadTemplate(id) {
    if (!id) return;
    setLoadingTemplate(true);
    setError("");
    try {
      const template = await loadBuiltinDetail(id);
      requestReplacement(normaliseScript(template));
    } catch (requestError) {
      setError(requestError.message || "Could not load built-in script.");
    } finally {
      setLoadingTemplate(false);
      setFileMenuOpen(false);
      setTemplateMenuOpen(false);
    }
  }

  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      requestReplacement({ name: fileNameToTitle(file.name), tags, sourceCode: await file.text() });
    } catch {
      setError("Could not read the selected JavaScript file.");
    }
  }

  function exportFile() {
    const fileName = `${(name.trim() || "script").replace(/[^a-z0-9_-]+/gi, "-")}.js`;
    const url = URL.createObjectURL(new Blob([sourceCode], { type: "text/javascript" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <ScriptEditorContainer onClose={requestClose} title={mode === "edit" ? "Edit Script" : "Add Script"}>
      <form className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" onSubmit={submit}>
        <div className="flex h-9 shrink-0 items-center">
          <div className="relative inline-flex" ref={fileMenuRef}>
            <button aria-expanded={fileMenuOpen} aria-haspopup="menu" className="inline-flex h-8 items-center gap-1 rounded px-2 text-sm font-medium text-slate-700 hover:bg-slate-100" onClick={() => { setFileMenuOpen((open) => !open); setTemplateMenuOpen(false); }} ref={fileButtonRef} type="button">
              <span><span className="underline decoration-current underline-offset-2">F</span>ile</span><ChevronDown className="h-4 w-4" />
            </button>
            {fileMenuOpen ? (
              <div className="absolute left-0 top-9 z-20 min-w-56 rounded-md border border-slate-200 bg-white py-1 shadow-lg" role="menu">
                <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => { setFileMenuOpen(false); fileInputRef.current?.click(); }} role="menuitem" type="button">
                  <FolderOpen className="h-4 w-4" /><span><span className="underline decoration-current underline-offset-2">O</span>pen</span>
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button aria-expanded={templateMenuOpen} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50" disabled={loadingTemplate} onClick={() => setTemplateMenuOpen((open) => !open)} role="menuitem" type="button">
                  <span className="inline-flex items-center gap-2"><FileCode2 className="h-4 w-4" /><span><span className="underline decoration-current underline-offset-2">L</span>oad Template</span></span>
                  <ChevronRight className="h-4 w-4" />
                </button>
                {templateMenuOpen ? (
                  <div className="border-t border-slate-100 py-1">
                    {builtinTemplates.length ? builtinTemplates.map((template) => (
                      <button className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" key={template.id} onClick={() => loadTemplate(template.id)} role="menuitem" type="button">{template.name}</button>
                    )) : <p className="px-3 py-2 text-sm text-slate-500">No templates available</p>}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <button className="ml-1 inline-flex h-8 items-center gap-1 rounded px-2 text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-50" disabled={!canSubmit || running} onClick={run} type="button">
            {running ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Run
          </button>
          <input accept=".js,text/javascript,application/javascript" aria-label="Open JavaScript File" className="hidden" onChange={importFile} ref={fileInputRef} type="file" />
        </div>
        <div className="flex min-h-32 flex-1 flex-col gap-0">
          <span className="text-sm font-medium text-slate-700">Source</span>
          <ScriptEditor bindings={bindings} onChange={setSourceCode} value={sourceCode} />
        </div>
        {sourceError ? <p className="text-xs text-rose-600">{sourceError}</p> : null}
        {bindingError ? <p className="text-xs text-amber-700">{bindingError}</p> : null}
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        <div className="flex shrink-0 flex-wrap items-end gap-3 pt-3">
          <div className="w-64"><Field hideLabel label="Name" placeholder="Script name" value={name} onChange={setName} /></div>
          <div className="w-64"><TagSetInput hideLabel label="Tags" onChange={setTags} placeholder="Add tags" suggestions={tagHints} value={tags} /></div>
          <div className="ml-auto flex gap-2">
          <button className="control-standard border border-slate-300 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50" onClick={requestClose} type="button">Cancel</button>
          <button className="control-standard inline-flex items-center justify-center gap-2 bg-teal-700 px-3 font-medium text-white hover:bg-teal-800 disabled:opacity-50" disabled={!canSubmit || submitting} type="submit">
            {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" />Save</>}
          </button>
          </div>
        </div>
      </form>
      {pendingAction ? <DiscardChangesModal onCancel={() => setPendingAction(null)} onDiscard={() => { const action = pendingAction; setPendingAction(null); action(); }} /> : null}
      {metadataOpen ? <MetadataModal name={name} onCancel={() => setMetadataOpen(false)} onNameChange={setName} onSave={(submittedTags) => save(saveAs, submittedTags)} onTagsChange={setTags} saving={submitting} saveAs={saveAs} tagHints={tagHints} tagHintsError={tagHintsError} tagHintsLoading={tagHintsLoading} tags={tags} /> : null}
    </ScriptEditorContainer>
  );
}

function ScriptEditorContainer({ children, onClose, title }) {
  return <Modal fullscreen title={title} onClose={onClose}>{children}</Modal>;
}

function MetadataModal({ name, onCancel, onNameChange, onSave, onTagsChange, saving, saveAs, tagHints, tagHintsError, tagHintsLoading, tags }) {
  return <Modal size="md" title={saveAs ? "Save Script As" : "Save Script"} onClose={onCancel}><form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); onSave(); }}><Field label="Name" value={name} onChange={onNameChange} />{tagHintsLoading ? <p className="text-sm text-slate-500">Loading tag suggestions…</p> : <><TagSetInput label="Tags" onChange={onTagsChange} onSubmit={onSave} placeholder="Add tags" suggestions={tagHints} value={tags} />{tagHintsError ? <p className="text-xs text-amber-700">Tag suggestions are unavailable. You can still enter tags manually.</p> : null}</>}<div className="flex justify-end gap-2"><button className="control-standard border border-slate-300 bg-white px-3 font-medium text-slate-700" onClick={onCancel} type="button">Cancel</button><button className="control-standard inline-flex items-center gap-2 bg-teal-700 px-3 font-medium text-white disabled:opacity-50" disabled={!name.trim() || saving} type="submit">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save</button></div></form></Modal>;
}

function DiscardChangesModal({ onCancel, onDiscard }) {
  const dialogRef = useModalDialog(true, onCancel);
  return (
    <div className="absolute inset-0 z-10 grid place-items-center rounded-lg bg-slate-950/25 p-4">
      <div aria-modal="true" className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-xl" ref={dialogRef} role="dialog">
        <div className="flex items-start justify-between gap-3"><h3 className="font-semibold text-slate-900">Discard unsaved changes?</h3><button aria-label="Close discard changes dialog" className="-mt-1 -mr-1 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onCancel} type="button"><X className="h-4 w-4" /></button></div>
        <p className="mt-2 text-sm text-slate-600">Your current script changes will be lost.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="control-standard border border-slate-300 bg-white px-3 font-medium text-slate-700" data-autofocus onClick={onCancel} type="button">Continue Editing</button>
          <button className="control-standard bg-rose-600 px-3 font-medium text-white" onClick={onDiscard} type="button">Proceed</button>
        </div>
      </div>
    </div>
  );
}

function sameTags(left, right) {
  return left.length === right.length && left.every((tag, index) => tag === right[index]);
}

