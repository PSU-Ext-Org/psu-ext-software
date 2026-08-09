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
import { useEffect, useMemo, useState } from "react";
import { Modal } from "../../../layout/dialogs/Modal.jsx";
import { DEFAULT_CHART_CONFIG, DEFAULT_CHART_SERIES } from "../chartConfig.js";
import { useScriptResultSeriesData } from "../hooks/useScriptResultSeriesData.js";
import { useScriptResultChartStatisticsConfig } from "../scriptResultChartStatisticsConfig.js";
import { ChartView } from "./ChartView.jsx";
import { ChartStatisticsSettings } from "./ChartStatisticsSettings.jsx";

/** Renders one persisted Script Runner result series through the standard chart view. */
export function ScriptResultChart({ onSettingsOpenChange = noop, seriesNames, settingsOpen = false, taskApiUrl, taskId }) {
  const series = useMemo(() => seriesNames.map((seriesName, index) => ({
    ...DEFAULT_CHART_SERIES,
    id: `script-result-${seriesName}`,
    label: seriesName,
    lineColor: SERIES_COLORS[index % SERIES_COLORS.length],
    seriesUrl: `${taskApiUrl}/${encodeURIComponent(taskId)}/series?series=${encodeURIComponent(seriesName)}`,
  })), [seriesNames, taskApiUrl, taskId]);
  const data = useScriptResultSeriesData({ series });
  const [statistics, setStatistics] = useScriptResultChartStatisticsConfig(series);
  const [draft, setDraft] = useState(statistics);

  useEffect(() => {
    if (!settingsOpen) setDraft(statistics);
  }, [settingsOpen, statistics]);

  const config = useMemo(() => ({
    ...DEFAULT_CHART_CONFIG,
    cardName: "Result chart",
    unit: data.unit,
    series,
    statistics,
  }), [data.unit, series, statistics]);

  return (
    <div className="relative h-full min-h-0">
      <ChartView
        config={config}
        rendererKey={data.rendererKey}
        seriesData={data.seriesData}
        statusText={data.statusText}
        targetText={`Task ${taskId.slice(0, 5)}`}
        usageText={data.usageText}
      />
      {settingsOpen ? (
        <Modal title="Result Chart Statistics" onClose={() => onSettingsOpenChange(false)} size="lg">
          <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); setStatistics(draft); onSettingsOpenChange(false); }}>
            <ChartStatisticsSettings idPrefix="script-result-chart-stat" statistics={draft} series={series} onChange={setDraft} />
            <div className="flex justify-end gap-2">
              <button className="control-standard border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50" onClick={() => onSettingsOpenChange(false)} type="button">Cancel</button>
              <button className="control-standard bg-teal-700 font-medium text-white hover:bg-teal-800" type="submit">Save</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

const SERIES_COLORS = ["#2563eb", "#0f766e", "#c2410c", "#7c3aed", "#be123c", "#047857"];

function noop() {}
