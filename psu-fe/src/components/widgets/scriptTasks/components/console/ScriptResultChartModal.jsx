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
import { Settings } from "lucide-react";
import { Modal } from "../../../../layout/dialogs/Modal.jsx";
import { ChartImageExportButton, ScriptResultChart } from "../../../chart/index.js";

/**
 * Presents a Script Runner result chart and keeps its header actions bound to the same export ID.
 *
 * @param {object} props
 * @param {() => void} props.onClose - Closes the result chart.
 * @param {(open: boolean) => void} props.onSettingsOpenChange - Controls the statistics dialog.
 * @param {string[]} props.seriesNames - Result series selected for display.
 * @param {boolean} props.settingsOpen - Whether the statistics dialog is open.
 * @param {string} props.taskApiUrl - Script Runner task API base URL.
 * @param {string} props.taskId - Task whose result series are displayed.
 * @returns {import("react").ReactElement}
 */
export function ScriptResultChartModal({
  onClose,
  onSettingsOpenChange,
  seriesNames,
  settingsOpen,
  taskApiUrl,
  taskId,
}) {
  const exportId = `script-result-chart:${taskId}`;

  function openSettings() {
    onSettingsOpenChange(true);
  }

  return (
    <Modal
      dialogClassName="h-[min(42rem,calc(100dvh-2rem))]"
      fill
      onClose={onClose}
      size="xl"
      title={(
        <ResultChartTitle
          exportId={exportId}
          onConfigure={openSettings}
        />
      )}
    >
      <ScriptResultChart
        exportId={exportId}
        onSettingsOpenChange={onSettingsOpenChange}
        seriesNames={seriesNames}
        settingsOpen={settingsOpen}
        taskApiUrl={taskApiUrl}
        taskId={taskId}
      />
    </Modal>
  );
}

function ResultChartTitle({ exportId, onConfigure }) {
  return (
    <span className="inline-flex h-6 items-center gap-1">
      <span>Result chart</span>
      <ChartImageExportButton compact exportId={exportId} />
      <button
        aria-label="Configure result chart statistics"
        className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        onClick={onConfigure}
        type="button"
      >
        <Settings className="h-4 w-4" />
      </button>
    </span>
  );
}
