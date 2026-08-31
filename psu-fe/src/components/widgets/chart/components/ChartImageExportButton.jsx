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
import { Download, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Modal } from "../../../layout/dialogs/Modal.jsx";
import { useChartImageExport } from "../export/chartExportRegistry.js";

/**
 * Exports the chart renderer registered under a matching runtime identity.
 *
 * @param {object} props
 * @param {boolean} [props.compact] - Uses modal-title icon sizing when true.
 * @param {string} props.exportId - Registry identity shared with the target chart renderer.
 * @returns {import("react").ReactElement}
 */
export function ChartImageExportButton({ compact = false, exportId }) {
  const imageExport = useChartImageExport(exportId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const disabled = !imageExport.ready || busy;

  async function handleExport() {
    if (!imageExport.supported) {
      setMessage("Export not supported yet");
      return;
    }
    if (!imageExport.exportPng) return;
    setBusy(true);
    try {
      await imageExport.exportPng();
    } catch {
      setMessage("Chart image export failed.");
    } finally {
      setBusy(false);
    }
  }

  function closeMessage() {
    setMessage("");
  }

  return (
    <>
      <button
        aria-label="Export chart as PNG"
        className={compact
          ? "inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          : "inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"}
        disabled={disabled}
        onClick={handleExport}
        onPointerDown={(event) => event.stopPropagation()}
        type="button"
      >
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      </button>
      {message ? (
        <Modal onClose={closeMessage} title="Chart export">
          <div className="grid gap-4">
            <p className="text-sm text-slate-700">{message}</p>
            <div className="flex justify-end">
              <button
                className="control-standard border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50"
                onClick={closeMessage}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
