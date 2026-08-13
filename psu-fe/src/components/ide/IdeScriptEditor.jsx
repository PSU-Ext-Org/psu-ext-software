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
import { useRef, useState } from "react";

import { ScriptEditor } from "../widgets/scriptEditor/components/ScriptEditor.jsx";
import { EMPTY_SCRIPT_SOURCE, scriptFileName, shortScriptId } from "../widgets/scriptEditor/utils/scriptDocument.js";
import { IdeDiscardChangesDialog } from "./components/IdeDiscardChangesDialog.jsx";
import { IdeEditorHeader } from "./components/IdeEditorHeader.jsx";
import { IdeSaveScriptDialog } from "./components/IdeSaveScriptDialog.jsx";
import { useIdeEditorDocument } from "./hooks/useIdeEditorDocument.js";
import { useIdeEditorResources } from "./hooks/useIdeEditorResources.js";
import { useIdeFileActions } from "./hooks/useIdeFileActions.js";
import { useIdePersistenceActions } from "./hooks/useIdePersistenceActions.js";
import { useIdeTemplateAction } from "./hooks/useIdeTemplateAction.js";
import { useSaveShortcut } from "./hooks/useSaveShortcut.js";

const EMPTY_TAG_HINTS = {
  error: "",
  load: undefined,
  loading: false,
  reload: undefined,
  tags: [],
};

/** Full-window editor shell for the document selected by the IDE workspace. */
export function IdeScriptEditor({
  bottomPanel,
  document: scriptDocument,
  loadBindings,
  loadBuiltinDetail,
  loadBuiltinTemplates,
  onClose,
  onOpenDocument,
  onOpenPopup,
  onPersist,
  onRun,
  tagHints = EMPTY_TAG_HINTS,
}) {
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const editorDocument = useIdeEditorDocument(scriptDocument, setError);
  const { bindings, templates } = useIdeEditorResources({
    loadBindings,
    loadBuiltinTemplates,
    onError: setError,
  });
  const persistence = useIdePersistenceActions({
    editorDocument,
    onPersist,
    onRun,
    setError,
    tagHints,
  });
  const fileActions = useIdeFileActions(editorDocument);
  const templateAction = useIdeTemplateAction({
    loadBuiltinDetail,
    replaceDocument: editorDocument.replaceDocument,
    requestAction: editorDocument.requestAction,
    setError,
  });

  useSaveShortcut(persistence.requestSave);

  const handleCreateDocument = () => {
    editorDocument.requestAction(() => {
      onOpenDocument({});
      editorDocument.replaceDocument({});
    });
  };

  const handleClose = () => {
    editorDocument.requestAction(onClose);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const headerActions = {
    close: handleClose,
    createDocument: handleCreateDocument,
    exportFile: fileActions.exportFile,
    importFile: handleImportClick,
    loadTemplate: templateAction.loadTemplate,
    openPopup: onOpenPopup,
    requestSave: persistence.requestSave,
    run: persistence.run,
  };
  const documentLabel = formatDocumentLabel(editorDocument);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <IdeEditorHeader
        actions={headerActions}
        canRun={editorDocument.canSave && !persistence.running}
        loadingTemplate={templateAction.loadingTemplate}
        running={persistence.running}
        templates={templates}
      />
      <main className="flex min-h-0 flex-1 flex-col p-4">
        <div className="shrink-0 rounded-t-md border border-slate-300 border-b-0 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
          {documentLabel}
        </div>
        <ScriptEditor
          bindings={bindings}
          flushTop
          onChange={editorDocument.setSourceCode}
          value={editorDocument.sourceCode || EMPTY_SCRIPT_SOURCE}
        />
        {editorDocument.sourceError ? (
          <p className="mt-2 text-xs text-rose-600">{editorDocument.sourceError}</p>
        ) : null}
        {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
      </main>
      {bottomPanel}
      <input
        accept=".js,text/javascript,application/javascript"
        aria-label="Import JavaScript File"
        className="hidden"
        onChange={fileActions.importFile}
        ref={fileInputRef}
        type="file"
      />
      {editorDocument.pendingAction ? (
        <IdeDiscardChangesDialog
          onCancel={editorDocument.cancelPendingAction}
          onDiscard={editorDocument.discardPendingAction}
        />
      ) : null}
      {persistence.saveDialogOpen ? (
        <IdeSaveScriptDialog
          initialName={editorDocument.name}
          initialTags={editorDocument.baseline.tags}
          onCancel={persistence.closeSaveDialog}
          onSave={persistence.saveAs}
          saving={persistence.saving}
          tagHints={tagHints}
        />
      ) : null}
    </div>
  );
}

/** Formats the editor tab label, including the dirty marker for persisted scripts. */
function formatDocumentLabel({ dirty, name, savedId }) {
  const documentId = savedId ? shortScriptId(savedId) : "*";
  const dirtyMarker = savedId && dirty ? " *" : "";
  return `${documentId} · ${scriptFileName(name)}${dirtyMarker}`;
}
