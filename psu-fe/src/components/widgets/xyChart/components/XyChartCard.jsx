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
import { ScatterChart } from "lucide-react";
import { useMemo, useState } from "react";
import { useWebSocketConnection } from "../../../../connection/ws-proxy/WebSocketConnectionContext.jsx";
import { useXyChartData } from "../hooks/useXyChartData.js";
import { XyChartRenderer } from "../renderers/XyChartRendererUplot.jsx";
import { getXyStatusText, getXyTargetText } from "../utils/xyChartStatus.js";
import { computeXyStatistics } from "../utils/xyStatistics.js";
import { DEFAULT_XY_CHART_CONFIG, isXyChartConfigured, useXyChartConfig } from "../xyChartConfig.js";

/**
 * Dynamic dashboard title for a persisted X-Y chart instance.
 *
 * @param {{placement: {id: string}}} props
 * @returns {import("react").ReactElement}
 */
export function XyChartCardTitle({ placement }) {
  const [config] = useXyChartConfig(placement.id);

  return <>{config.cardName || DEFAULT_XY_CHART_CONFIG.cardName}</>;
}

/**
 * Dashboard widget that plots one SCPI query against another (for example current against voltage).
 *
 * @param {{placement: {id: string}}} props
 * @returns {import("react").ReactElement}
 */
export function XyChartCard({ placement }) {
  const {
    getScpiQuerySnapshot,
    subscribeScpiSnapshot = noopSubscribe,
    wsConnected,
    devices = [],
    deviceStatuses = {},
  } = useWebSocketConnection();
  const [config] = useXyChartConfig(placement.id);
  const { points, snapshots, usageText } = useXyChartData({
    widgetId: placement.id,
    config,
    getScpiQuerySnapshot,
    subscribeScpiSnapshot,
  });
  const [visibleRanges, setVisibleRanges] = useState(null);
  const { statistics, statisticsSeries, unit: statisticsUnit } = useMemo(
    () => computeXyStatistics({ points, config, visibleRanges }),
    [config, points, visibleRanges],
  );
  const configured = isXyChartConfigured(config);
  const statusText = useMemo(
    () => getXyStatusText({ config, devices, deviceStatuses, snapshots, wsConnected }),
    [config, devices, deviceStatuses, snapshots, wsConnected],
  );

  if (!configured) {
    return (
      <div className="flex min-h-full items-start">
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Configure X and Y devices and SCPI queries.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <XyChartRenderer
        chartExport={{ id: placement.id, fileStem: config.cardName }}
        lineColor={config.lineColor}
        onVisibleRangesChange={setVisibleRanges}
        points={points}
        productAxis={config.product}
        productColor={config.productColor}
        showLine={config.showLine}
        showProduct={config.showProduct}
        statistics={statistics}
        statisticsConfig={config.statistics}
        statisticsSeries={statisticsSeries}
        statisticsUnit={statisticsUnit}
        statusText={statusText}
        targetText={getXyTargetText(config)}
        usageText={usageText}
        xAxis={config.x}
        yAxis={config.y}
      />
    </div>
  );
}

function noopSubscribe() {
  return () => {};
}

export const XyChartIcon = ScatterChart;
