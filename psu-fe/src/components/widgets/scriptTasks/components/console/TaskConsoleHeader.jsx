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
import { X } from "lucide-react";
import { memo } from "react";

/** Resizable task-console header with task identity and close action. */
export const TaskConsoleHeader = memo(function TaskConsoleHeader({ drag, height, name, onClose, status, taskId }) {
  function startResize(event) {
    drag.current = { height, y: event.clientY };
  }

  function stopResizePropagation(event) {
    event.stopPropagation();
  }

  return (
    <header
      aria-label="Resize task console"
      className="flex shrink-0 cursor-row-resize touch-none items-center border-b border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500"
      onPointerDown={startResize}
    >
      <span>{taskId.slice(0, 5)}</span>
      <span className="mx-2 shrink-0 text-slate-300">·</span>
      <span className="max-w-96 truncate">{name || "Script task"}</span>
      <span className="mx-2 shrink-0 text-slate-300">·</span>
      <span className="shrink-0">{status}</span>
      <button aria-label="Close task console" className="ml-auto cursor-pointer rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700" onClick={onClose} onPointerDown={stopResizePropagation} type="button">
        <X className="h-4 w-4" />
      </button>
    </header>
  );
});
