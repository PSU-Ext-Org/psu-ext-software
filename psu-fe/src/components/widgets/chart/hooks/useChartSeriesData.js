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
import {
  formatChartHistoryUsage,
  getChartHistoryUsageBytes,
  loadChartHistory,
  saveChartHistory,
} from "../storage/chartHistoryStorage.js";
import { mergeSeriesPoints, normalizeSnapshotPoints } from "../utils/chartSeriesData.js";

/**
 * Converts SCPI snapshots into renderer-ready time-series data.
 *
 * @param {object} params
 * @param {object} params.config
 * @param {(deviceName: string, query: string) => {value: string, points?: Array, updatedAt: number, loading: boolean, error: string}} params.getScpiQuerySnapshot
 * @param {(deviceName: string, query: string, listener: () => void) => () => void} params.subscribeScpiSnapshot
 * @param {string} params.widgetId
 * @returns {{rendererKey: string, seriesData: ChartSeriesData[], snapshotsBySeriesId: Record<string, {value: string, updatedAt: number, loading: boolean, error: string}>, usageText: string}}
 */
export function useChartSeriesData({ config, getScpiQuerySnapshot, subscribeScpiSnapshot, widgetId }) {
  const [seriesData, setSeriesData] = useState(() => loadChartHistory(widgetId, config));
  const [snapshotsBySeriesId, setSnapshotsBySeriesId] = useState({});
  const [historyEpoch, setHistoryEpoch] = useState(0);
  const seriesKey = useMemo(
    () =>
      config.series
        .map((series) => [series.id, series.label, series.lineColor, series.deviceName, series.query].join("|"))
        .join("||"),
    [config.series],
  );

  useEffect(() => {
    setSeriesData(loadChartHistory(widgetId, config));
    setSnapshotsBySeriesId({});
  }, [config, seriesKey, widgetId]);

  useEffect(() => {
    function syncHistory(event) {
      if (!event.detail?.widgetId || event.detail.widgetId === widgetId) {
        setSeriesData(loadChartHistory(widgetId, config));
        if (event.detail?.action === "delete") {
          setSnapshotsBySeriesId({});
          setHistoryEpoch((current) => current + 1);
        }
      }
    }

    window.addEventListener("psu-ext-chart-history-change", syncHistory);
    window.addEventListener("storage", syncHistory);
    return () => {
      window.removeEventListener("psu-ext-chart-history-change", syncHistory);
      window.removeEventListener("storage", syncHistory);
    };
  }, [config, widgetId]);

  useEffect(() => {
    const unsubscribers = config.series
      .filter((series) => series.deviceName && series.query)
      .map((series) => {
        const appendCurrentSnapshot = () => {
          const snapshot = getScpiQuerySnapshot(series.deviceName, series.query);
          setSnapshotsBySeriesId((current) => ({ ...current, [series.id]: snapshot }));
          const points = normalizeSnapshotPoints(snapshot);
          if (!points.length) {
            return;
          }

          setSeriesData((current) => {
            const nextSeriesData = mergeSeriesPoints(current, series, points);
            return saveChartHistory(widgetId, config, nextSeriesData);
          });
        };

        appendCurrentSnapshot();
        return subscribeScpiSnapshot(series.deviceName, series.query, appendCurrentSnapshot);
      });

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }, [config, getScpiQuerySnapshot, historyEpoch, seriesKey, subscribeScpiSnapshot, widgetId]);

  return {
    rendererKey: `${widgetId}:${seriesKey}:${historyEpoch}`,
    seriesData,
    snapshotsBySeriesId,
    usageText: formatChartHistoryUsage(getChartHistoryUsageBytes(config, seriesData), config.historyLimitBytes),
  };
}

/**
 * @typedef {object} ChartPoint
 * @property {number} t
 * @property {number} y
 * @property {number} [sourceT]
 */

/**
 * @typedef {object} ChartSeriesData
 * @property {string} id
 * @property {string} label
 * @property {string} color
 * @property {ChartPoint[]} points
 */
