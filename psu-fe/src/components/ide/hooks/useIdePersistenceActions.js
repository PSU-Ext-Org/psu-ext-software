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
import { useCallback, useState } from "react";

import { normaliseScript, parseTags } from "../../widgets/scriptEditor/utils/scriptDocument.js";

/** Owns Save, Save As, and Run workflows for the current editor document. */
export function useIdePersistenceActions({ editorDocument, onPersist, onRun, setError, tagHints }) {
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const {
    baseline,
    canSave,
    name,
    replaceDocument,
    savedId,
    setBaseline,
    setName,
    setSavedId,
    setSourceCode,
    sourceCode,
    sourceError,
  } = editorDocument;
  const loadTagHints = tagHints.load;
  const reloadTagHints = tagHints.reload;

  const save = useCallback(async (forceCreate = false, metadata = null) => {
    const nextName = metadata?.name?.trim() || name.trim();
    const nextTags = metadata ? parseTags(metadata.tags) : baseline.tags || [];
    if (!nextName || !sourceCode.trim() || sourceError || saving) return;

    setSaving(true);
    setError("");
    try {
      const saved = await onPersist(
        { name: nextName, sourceCode, tags: nextTags },
        forceCreate ? null : savedId,
        forceCreate,
      );
      const next = normaliseScript(saved);
      setSavedId(saved.id);
      setBaseline(next);
      setName(next.name);
      setSourceCode(next.sourceCode);
      setSaveDialogOpen(false);
      if (!savedId || forceCreate) await reloadTagHints?.();
    } catch (requestError) {
      setError(requestError.message || "Could not save script.");
    } finally {
      setSaving(false);
    }
  }, [
    baseline.tags,
    name,
    onPersist,
    reloadTagHints,
    savedId,
    saving,
    setBaseline,
    setError,
    setName,
    setSavedId,
    setSourceCode,
    sourceCode,
    sourceError,
  ]);

  const requestSave = useCallback((forceCreate) => {
    if (forceCreate || !savedId) {
      setSaveDialogOpen(true);
      void loadTagHints?.();
      return;
    }
    void save(false);
  }, [loadTagHints, save, savedId]);

  const closeSaveDialog = useCallback(() => {
    setSaveDialogOpen(false);
  }, []);

  const saveAs = useCallback((metadata) => save(true, metadata), [save]);

  const run = useCallback(async () => {
    if (!canSave || running) return;

    setRunning(true);
    setError("");
    try {
      const result = await onRun(
        {
          name: name.trim(),
          sourceCode,
          tags: baseline.tags || [],
        },
        savedId,
      );
      replaceDocument(result.script);
      await reloadTagHints?.();
    } catch (requestError) {
      setError(requestError.message || "Could not save and run script.");
    } finally {
      setRunning(false);
    }
  }, [
    baseline.tags,
    canSave,
    name,
    onRun,
    reloadTagHints,
    replaceDocument,
    running,
    savedId,
    setError,
    sourceCode,
  ]);

  return {
    closeSaveDialog,
    requestSave,
    run,
    running,
    saveAs,
    saveDialogOpen,
    saving,
  };
}
