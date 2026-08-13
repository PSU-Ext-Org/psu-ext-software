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
import { useEffect } from "react";

/** Binds the platform Save shortcut to the current editor save action. */
export function useSaveShortcut(requestSave) {
  useEffect(() => {
    function handleKeyDown(event) {
      const isSaveShortcut = (event.ctrlKey || event.metaKey)
        && !event.altKey
        && event.key.toLowerCase() === "s";
      if (!isSaveShortcut) return;

      event.preventDefault();
      requestSave(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [requestSave]);
}
