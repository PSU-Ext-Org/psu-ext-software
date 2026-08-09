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
import { useEffect, useState } from "react";
import { createDefaultChartStatisticsConfig, normalizeChartStatisticsConfig } from "./utils/chartStatistics.js";

export const SCRIPT_RESULT_CHART_STATISTICS_STORAGE_KEY = "psu-ext.ide-result-chart-statistics.v1";
const CHANGE_EVENT = "psu-ext-ide-result-chart-statistics-change";

export function loadScriptResultChartStatisticsConfig(series = []) {
  try {
    return normalizeChartStatisticsConfig(
      JSON.parse(window.localStorage.getItem(SCRIPT_RESULT_CHART_STATISTICS_STORAGE_KEY) || "null"),
      series,
    );
  } catch {
    return createDefaultChartStatisticsConfig(series);
  }
}

export function saveScriptResultChartStatisticsConfig(config, series = []) {
  const normalized = normalizeChartStatisticsConfig(config, series);
  window.localStorage.setItem(SCRIPT_RESULT_CHART_STATISTICS_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  return normalized;
}

export function useScriptResultChartStatisticsConfig(series = []) {
  const seriesKey = series.map((item) => item.id).join("|");
  const [config, setConfig] = useState(() => loadScriptResultChartStatisticsConfig(series));

  useEffect(() => {
    const reload = () => setConfig(loadScriptResultChartStatisticsConfig(series));
    reload();
    window.addEventListener(CHANGE_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(CHANGE_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, [seriesKey]); // seriesKey deliberately tracks only the ids used for selection validation.

  return [config, (next) => setConfig(saveScriptResultChartStatisticsConfig(next, series))];
}
