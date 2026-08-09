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
import { SlidingToggle } from "../../../forms/SlidingToggle.jsx";
import { CHART_STATISTICS } from "../utils/chartStatistics.js";
import { ChartStatisticInfoButton } from "./ChartStatisticInfoButton.jsx";

/**
 * Source-independent controls for selecting the chart statistics to display.
 * The parent owns the draft state so the same controls can be used by both
 * persisted dashboard charts and task-result charts.
 */
export function ChartStatisticsSettings({ idPrefix = "chart-stat", series = [], statistics, onChange }) {
  function update(key, value) {
    onChange({ ...statistics, [key]: value });
  }

  function updateEnabledStat(statId, value) {
    onChange({
      ...statistics,
      enabledStats: { ...statistics.enabledStats, [statId]: value },
    });
  }

  return (
    <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="grid gap-0.5">
          <span className="text-sm font-medium text-slate-700">Show statistics</span>
          <span className="text-xs text-slate-500">Show summary values for one selected series on the chart.</span>
        </div>
        <SlidingToggle ariaLabel="Show statistics" checked={statistics.showStatistics} onClick={() => update("showStatistics", !statistics.showStatistics)} />
      </div>

      {statistics.showStatistics ? (
        <>
          {series.length > 1 ? (
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Statistics series
              <select className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700" onChange={(event) => update("seriesId", event.target.value)} value={statistics.seriesId}>
                {series.map((item) => <option key={item.id} value={item.id}>{item.label || item.id}</option>)}
              </select>
            </label>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            {CHART_STATISTICS.map((statistic) => {
              const inputId = `${idPrefix}-${statistic.id}`;
              return (
                <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700" key={statistic.id}>
                  <div className="flex min-w-0 items-center gap-2">
                    <label className="min-w-0 cursor-pointer truncate" htmlFor={inputId}>{statistic.label}</label>
                    <ChartStatisticInfoButton statId={statistic.id} />
                  </div>
                  <input aria-label={`Show ${statistic.label}`} checked={Boolean(statistics.enabledStats[statistic.id])} className="h-4 w-4 shrink-0 rounded border-slate-300 text-teal-700 focus:ring-teal-700" id={inputId} onChange={(event) => updateEnabledStat(statistic.id, event.target.checked)} type="checkbox" />
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
