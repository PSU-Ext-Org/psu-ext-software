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
import { useEffect, useRef } from "react";

const FIRST_INPUT_SELECTOR = "input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled), [contenteditable=true], [data-autofocus]";

/** Applies shared Escape and initial-input focus behavior to a modal dialog. */
export function useModalDialog(open, onClose) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    const dialog = dialogRef.current;
    requestAnimationFrame(() => dialog?.querySelector(FIRST_INPUT_SELECTOR)?.focus({ focusVisible: true }));

    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      const dialogs = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')];
      if (dialogs.at(-1) !== dialogRef.current) return;
      event.preventDefault();
      onCloseRef.current();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return dialogRef;
}
