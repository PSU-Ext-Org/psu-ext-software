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
import { useEffect, useState } from "react";

import { requestJson } from "../api/ideScriptApi.js";

const LAST_SCRIPT_KEY = "psu-fe.ide.last-script-id";

/** Restores and persists the Script Runner document selected by the IDE. */
export function useIdeDocument(scriptSourceApiUrl) {
  const [document, setDocument] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = window.localStorage.getItem(LAST_SCRIPT_KEY);
    if (!id) {
      setReady(true);
      return;
    }
    requestJson(`${scriptSourceApiUrl}/user/${encodeURIComponent(id)}`)
      .then(setDocument)
      .catch(() => window.localStorage.removeItem(LAST_SCRIPT_KEY))
      .finally(() => setReady(true));
  }, [scriptSourceApiUrl]);

  function openDocument(nextDocument = {}) {
    if (nextDocument.id) window.localStorage.setItem(LAST_SCRIPT_KEY, nextDocument.id);
    else window.localStorage.removeItem(LAST_SCRIPT_KEY);
    setDocument(nextDocument);
  }

  function persistDocument(savedDocument) {
    if (savedDocument?.id) {
      window.localStorage.setItem(LAST_SCRIPT_KEY, savedDocument.id);
      setDocument(savedDocument);
    }
  }

  return { document, openDocument, persistDocument, ready };
}
