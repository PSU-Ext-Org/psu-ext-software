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
import { useCallback } from "react";

import { fileNameToTitle } from "../../widgets/scriptEditor/utils/scriptDocument.js";

/** Provides browser-file import and export actions for the editor buffer. */
export function useIdeFileActions({ name, replaceDocument, requestAction, sourceCode }) {
  const importFile = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const contents = await file.text();
    requestAction(() => {
      replaceDocument({
        name: fileNameToTitle(file.name),
        sourceCode: contents,
      });
    });
  }, [replaceDocument, requestAction]);

  const exportFile = useCallback(() => {
    const filename = `${(name.trim() || "script").replace(/[^a-z0-9_-]+/gi, "-")}.js`;
    const url = URL.createObjectURL(new Blob([sourceCode], { type: "text/javascript" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, [name, sourceCode]);

  return { exportFile, importFile };
}
