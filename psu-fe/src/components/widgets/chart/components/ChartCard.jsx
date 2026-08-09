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
import { LineChart } from "lucide-react";
import { useMemo } from "react";
import { useWebSocketConnection } from "../../../../connection/ws-proxy/WebSocketConnectionContext.jsx";
import { ChartCardActions } from "./ChartCardActions.jsx";
import { ChartView } from "./ChartView.jsx";
import { getStatusText, validateRunnableSeries } from "../utils/chartStatus.js";
import { useChartConfig } from "../hooks/useChartConfig.js";
import { useChartSeriesData } from "../hooks/useChartSeriesData.js";
import { DEFAULT_CHART_CONFIG } from "../chartConfig.js";

/**
 * Dynamic dashboard title for a persisted ChartCard instance.
 *
 * @param {{placement: {id: string}}} props
 * @returns {import("react").ReactElement}
 */
export function ChartCardTitle({ placement }) {
  const [config] = useChartConfig(placement.id);

  return <>{config.cardName || DEFAULT_CHART_CONFIG.cardName}</>;
}

/**
 * 2x1 dashboard widget that plots cached SCPI query values over time.
 *
 * @param {{placement: {id: string}}} props
 * @returns {import("react").ReactElement}
 */
export function ChartCard({ placement }) {
  const {
    getScpiQuerySnapshot,
    subscribeScpiSnapshot = noopSubscribe,
    wsConnected,
    devices = [],
    deviceStatuses = {},
  } = useWebSocketConnection();
  const [config] = useChartConfig(placement.id);
  const { rendererKey, seriesData, snapshotsBySeriesId, usageText } = useChartSeriesData({
    config,
    getScpiQuerySnapshot,
    subscribeScpiSnapshot,
    widgetId: placement.id,
  });
  const deviceByName = useMemo(
    () => new Map(devices.map((candidate) => [candidate.name, candidate])),
    [devices],
  );
  const firstSeries = config.series[0];
  const validationError = validateRunnableSeries(firstSeries);
  const device = deviceByName.get(firstSeries?.deviceName);
  const deviceConnected = Boolean(device && deviceStatuses[device.id]?.state === "CONNECTED");
  const statusText = getStatusText({
    device,
    deviceConnected,
    series: firstSeries,
    snapshot: snapshotsBySeriesId[firstSeries?.id],
    validationError,
    wsConnected,
  });

  if (!firstSeries?.deviceName || !firstSeries?.query) {
    return (
      <div className="flex min-h-full items-start">
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Configure a target device and SCPI query.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <ChartView
        config={config}
        rendererKey={rendererKey}
        seriesData={seriesData}
        statusText={statusText}
        targetText={firstSeries.deviceName}
        usageText={usageText}
      />
    </div>
  );
}

function noopSubscribe() {
  return () => {};
}

export { ChartCardActions };
export const ChartIcon = LineChart;
