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
/** Initial placements from dashboard caa7c60d-8ffe-479d-b66a-fd97f5aacbaf. */
export const defaultDashboardTwoLayout = [
  { id: "chart-other-large-9f8e41dc", type: "chart", x: 0, y: 0, w: 3, h: 2 },
];

/** Power chart settings for PSUEXT1, without recorded measurements. */
export const defaultDashboardTwoWidgetConfigs = {
  "chart-other-large-9f8e41dc": {
    type: "chart",
    cardName: "Power",
    unit: "W",
    frequencyHz: 1,
    historyLimitBytes: 262144,
    series: [
      {
        id: "series-1",
        label: "W",
        deviceName: "PSUEXT1",
        query: "MEAS:POWER:DATA? CH1",
        lineColor: "#2563eb",
      },
    ],
    statistics: {
      showStatistics: true,
      seriesId: "series-1",
      enabledStats: {
        count: true,
        avg: false,
        median: false,
        min: true,
        max: true,
        ripplePeakToPeak: true,
        rippleRms: false,
        typicalRippleP95P5: false,
        stdDev: false,
        maxDelta: false,
        avgDelta: false,
        trendPerSecond: false,
        drift: false,
        spikeCount: false,
        frequencyHz: false,
        periodSeconds: false,
      },
    },
  },
};
