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
import { useModalDialog } from "../hooks/useModalDialog.js";
import { WebSocketMonitorCard } from "./WebSocketMonitor.jsx";

/**
 * Modal popup for the shared WebSocket monitor.
 *
 * @param {object} props
 * @param {boolean} props.open - Whether the dialog is visible.
 * @param {() => void} props.onClose - Called to close the dialog.
 * @returns {import("react").ReactElement | null}
 */
export function WebSocketMonitorDialog({ open, onClose }) {
  const dialogRef = useModalDialog(open, onClose);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/50 px-4 py-6">
      <div className="flex min-h-full items-start justify-center sm:items-center">
        <div
          aria-labelledby="websocket-monitor-title"
          aria-modal="true"
          className="relative w-full max-w-5xl"
          role="dialog"
          ref={dialogRef}
        >
          <h2 id="websocket-monitor-title" className="sr-only">
            WebSocket Monitor
          </h2>
          <button
            aria-label="Close WebSocket monitor"
            className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
          <WebSocketMonitorCard logClassName="h-[min(60vh,34rem)]" />
        </div>
      </div>
    </div>
  );
}
