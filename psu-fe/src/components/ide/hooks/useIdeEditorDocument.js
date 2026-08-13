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
import { useCallback, useEffect, useRef, useState } from "react";

import { normaliseScript, validateWrappedScript } from "../../widgets/scriptEditor/utils/scriptDocument.js";

/** Owns the editable script buffer and guards replacement of dirty documents. */
export function useIdeEditorDocument(scriptDocument, clearError) {
  const [name, setName] = useState(() => normaliseScript(scriptDocument).name);
  const [sourceCode, setSourceCode] = useState(() => normaliseScript(scriptDocument).sourceCode);
  const [savedId, setSavedId] = useState(scriptDocument?.id || null);
  const [baseline, setBaseline] = useState(() => normaliseScript(scriptDocument));
  const [pendingAction, setPendingAction] = useState(null);
  const sourceError = validateWrappedScript(sourceCode);
  const dirty = name !== baseline.name || sourceCode !== baseline.sourceCode;
  const canSave = Boolean(name.trim() && sourceCode.trim() && !sourceError);
  const dirtyRef = useRef(dirty);
  const savedIdRef = useRef(savedId);
  dirtyRef.current = dirty;
  savedIdRef.current = savedId;

  const replaceDocument = useCallback((nextDocument = {}) => {
    const next = normaliseScript(nextDocument);
    setName(next.name);
    setSourceCode(next.sourceCode);
    setSavedId(nextDocument.id || null);
    setBaseline(next);
    clearError("");
  }, [clearError]);

  useEffect(() => {
    const next = normaliseScript(scriptDocument);
    if (!dirtyRef.current) {
      setName(next.name);
      setSourceCode(next.sourceCode);
      setSavedId(scriptDocument?.id || null);
      setBaseline(next);
      clearError("");
    } else if (scriptDocument?.id !== savedIdRef.current) {
      setPendingAction(() => () => replaceDocument(scriptDocument));
    }
  }, [clearError, replaceDocument, scriptDocument]);

  const requestAction = useCallback((action) => {
    if (dirty) {
      setPendingAction(() => action);
      return;
    }
    action();
  }, [dirty]);

  const cancelPendingAction = useCallback(() => {
    setPendingAction(null);
  }, []);

  const discardPendingAction = useCallback(() => {
    const action = pendingAction;
    setPendingAction(null);
    action?.();
  }, [pendingAction]);

  return {
    baseline,
    canSave,
    cancelPendingAction,
    dirty,
    discardPendingAction,
    name,
    pendingAction,
    replaceDocument,
    requestAction,
    savedId,
    setBaseline,
    setName,
    setSavedId,
    setSourceCode,
    sourceCode,
    sourceError,
  };
}
