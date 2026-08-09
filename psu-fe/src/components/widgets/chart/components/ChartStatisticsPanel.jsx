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
import {
  getEnabledChartStatistics,
} from "../utils/chartStatistics.js";

/**
 * @param {object} props
 * @param {string} [props.className]
 * @param {{enabledStats?: Record<string, boolean>, showStatistics?: boolean} | undefined} props.statisticsConfig
 * @param {{label?: string} | undefined} props.statisticsSeries
 * @param {{sampleCount?: number, values?: Record<string, number | null>} | undefined} props.stats
 * @param {string} props.unit
 * @returns {import("react").ReactElement | null}
 */
export function ChartStatisticsPanel({ className = "", statisticsConfig, statisticsSeries, stats, unit }) {
  const enabledStatistics = getEnabledChartStatistics(statisticsConfig?.enabledStats);
  const sampleCount = stats?.sampleCount ?? stats?.count ?? 0;
  const values = stats?.values || stats || {};

  if (!statisticsConfig?.showStatistics || !sampleCount || !enabledStatistics.length) {
    return null;
  }

  return (
    <section
      aria-label="Chart statistics"
      className={[
        "rounded-md border border-slate-200 bg-slate-50/90 text-[0.6875rem] text-slate-700 shadow-sm backdrop-blur-sm",
        className,
      ].join(" ").trim()}
      data-testid="chart-statistics"
    >
      <div className="border-b border-slate-200 px-2 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {statisticsSeries?.label ? `${statisticsSeries.label} stats` : "Statistics"}
      </div>
      <div
        className="grid auto-cols-[minmax(8rem,1fr)] grid-flow-col grid-rows-4 gap-x-3 gap-y-1 px-2 py-1.5"
        style={{ gridTemplateRows: `repeat(${Math.min(enabledStatistics.length, 4)}, minmax(0, auto))` }}
      >
        {enabledStatistics.map((statistic) => {
          return (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2" key={statistic.id}>
              <span className="truncate text-slate-600">{statistic.label}</span>
              <span className="text-right font-medium text-slate-800">
                {statistic.formatValue(values[statistic.id], { unit })}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
