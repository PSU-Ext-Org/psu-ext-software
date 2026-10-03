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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatChartHistoryUsage } from "../../chart/storage/chartHistoryStorage.js";
import {
  deleteXyChartHistory,
  getXyChartHistoryUsageBytes,
  loadXyChartHistory,
  saveXyChartHistory,
  XY_CHART_HISTORY_CHANGE_EVENT,
  XY_CHART_HISTORY_STORAGE_KEY,
} from "../storage/xyChartHistoryStorage.js";
import { isXyChartConfigured, XY_AXES } from "../xyChartConfig.js";
import { createXyPairer } from "../utils/xyPairing.js";

const EMPTY_SNAPSHOT = Object.freeze({ value: "", updatedAt: 0, loading: false, error: "" });
const EMPTY_SNAPSHOTS = Object.freeze({ x: EMPTY_SNAPSHOT, y: EMPTY_SNAPSHOT });

/**
 * Builds X-Y points from the cached SCPI snapshots of the X and Y queries.
 *
 * Points are stored in `localStorage` per widget, newest last, and pruned to `config.historyLimitBytes` by dropping
 * the oldest points. Stored points are shown again after a reload as long as the X and Y devices and queries are
 * unchanged; points recorded for another device or query are not shown.
 *
 * @param {object} params
 * @param {string} params.widgetId - Storage key of this chart; also matches `deleteXyChartHistory(widgetId)`.
 * @param {import("../xyChartConfig.js").DEFAULT_XY_CHART_CONFIG} params.config
 * @param {(deviceName: string, query: string) => {value: string, updatedAt: number, loading: boolean, error: string}} params.getScpiQuerySnapshot
 * @param {(deviceName: string, query: string, listener: () => void) => () => void} params.subscribeScpiSnapshot
 * @returns {{
 *   points: Array<{x: number, y: number, t: number}>,
 *   snapshots: {x: object, y: object},
 *   usageText: string,
 *   clear: () => void
 * }}
 */
export function useXyChartData({ widgetId, config, getScpiQuerySnapshot, subscribeScpiSnapshot }) {
  const [points, setPoints] = useState(() => loadXyChartHistory(widgetId, config));
  const [snapshots, setSnapshots] = useState(EMPTY_SNAPSHOTS);
  const [epoch, setEpoch] = useState(0);
  const configured = isXyChartConfigured(config);
  const { historyLimitBytes, pairTimeoutMs } = config;
  const configRef = useRef(config);
  const sourceKey = JSON.stringify(XY_AXES.map((axis) => [config[axis].deviceName, config[axis].query]));
  configRef.current = config;

  useEffect(() => {
    setPoints((current) => (current.length ? saveXyChartHistory(widgetId, configRef.current, current) : current));
  }, [historyLimitBytes, widgetId]);

  // Only the source (devices and queries), pairing timeout and clear epoch restart collection; the rest of the
  // config is read through a ref when a point is saved.
  useEffect(() => {
    setPoints(loadXyChartHistory(widgetId, configRef.current));
    setSnapshots(EMPTY_SNAPSHOTS);
    if (!configured) {
      return undefined;
    }

    const pairer = createXyPairer({
      timeoutMs: pairTimeoutMs,
      onPoint: ({ x, y, t }) => {
        setPoints((current) => saveXyChartHistory(widgetId, configRef.current, [...current, { x, y, t }]));
      },
    });
    const lastUpdatedAt = { x: 0, y: 0 };
    const unsubscribers = XY_AXES.map((axis) => {
      const { deviceName, query } = configRef.current[axis];
      const read = (seed) => {
        const snapshot = getScpiQuerySnapshot(deviceName, query);
        setSnapshots((current) => ({ ...current, [axis]: snapshot }));

        const isNewUpdate = snapshot.updatedAt > lastUpdatedAt[axis];
        lastUpdatedAt[axis] = Math.max(lastUpdatedAt[axis], snapshot.updatedAt);
        const value = parseNumericValue(snapshot.value);
        if (!snapshot.updatedAt || snapshot.error || !Number.isFinite(value)) {
          return;
        }

        if (seed) {
          pairer.seed(axis, { value, t: snapshot.updatedAt });
        } else if (isNewUpdate) {
          pairer.update(axis, { value, t: snapshot.updatedAt });
        }
      };

      read(true);
      return subscribeScpiSnapshot(deviceName, query, () => read(false));
    });

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
      pairer.dispose();
    };
  }, [configured, epoch, getScpiQuerySnapshot, pairTimeoutMs, sourceKey, subscribeScpiSnapshot, widgetId]);

  useEffect(() => {
    function handleHistoryChange(event) {
      if (event.detail?.widgetId === widgetId && event.detail.action === "delete") {
        setPoints([]);
        setEpoch((current) => current + 1);
      }
    }

    function handleStorage(event) {
      if (event.key === XY_CHART_HISTORY_STORAGE_KEY) {
        setPoints(loadXyChartHistory(widgetId, configRef.current));
      }
    }

    window.addEventListener(XY_CHART_HISTORY_CHANGE_EVENT, handleHistoryChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(XY_CHART_HISTORY_CHANGE_EVENT, handleHistoryChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [widgetId]);

  const clear = useCallback(() => deleteXyChartHistory(widgetId), [widgetId]);
  const usageText = useMemo(
    () => formatChartHistoryUsage(getXyChartHistoryUsageBytes(config, points), historyLimitBytes),
    [config, historyLimitBytes, points],
  );

  return { points, snapshots, usageText, clear };
}

function parseNumericValue(value) {
  return Number.parseFloat(String(value ?? "").trim());
}
