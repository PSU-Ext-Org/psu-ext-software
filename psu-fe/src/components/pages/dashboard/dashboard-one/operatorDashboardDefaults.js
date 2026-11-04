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

// Initial placements from dashboard df9eee1a-740c-4434-87b8-29bee9fbea37.
export const defaultOperatorLayout = [
  {
    "id": "single-value-dashboard-d5ae9f05",
    "type": "singleValue",
    "x": 2,
    "y": 2,
    "w": 1,
    "h": 1
  },
  {
    "id": "chart-dashboard-medium-92201d6a",
    "type": "chart",
    "x": 0,
    "y": 2,
    "w": 2,
    "h": 2
  },
  {
    "id": "single-toggle-dashboard-15d34293",
    "type": "singleToggle",
    "x": 2,
    "y": 0,
    "w": 1,
    "h": 1
  },
  {
    "id": "single-value-dashboard-b5ee19ab",
    "type": "singleValue",
    "x": 2,
    "y": 4,
    "w": 1,
    "h": 1
  },
  {
    "id": "single-value-dashboard-662da800",
    "type": "singleValue",
    "x": 2,
    "y": 6,
    "w": 1,
    "h": 1
  },
  {
    "id": "chart-dashboard-medium-89311ca7",
    "type": "chart",
    "x": 0,
    "y": 6,
    "w": 2,
    "h": 2
  },
  {
    "id": "chart-dashboard-medium-59f9bf7b",
    "type": "chart",
    "x": 0,
    "y": 0,
    "w": 2,
    "h": 2
  },
  {
    "id": "single-value-dashboard-b015f2a7",
    "type": "singleValue",
    "x": 2,
    "y": 1,
    "w": 1,
    "h": 1
  },
  {
    "id": "protection-dashboard-05af8ac2",
    "type": "protectionControl",
    "x": 2,
    "y": 3,
    "w": 1,
    "h": 1
  },
  {
    "id": "single-value-dashboard-d8d35a2c",
    "type": "singleValue",
    "x": 2,
    "y": 5,
    "w": 1,
    "h": 1
  },
  {
    "id": "single-value-dashboard-982930ac",
    "type": "singleValue",
    "x": 2,
    "y": 7,
    "w": 1,
    "h": 1
  },
  {
    "id": "chart-dashboard-medium-36f644fa",
    "type": "chart",
    "x": 0,
    "y": 4,
    "w": 2,
    "h": 2
  }
];

/** Configuration only; no device records or measurement history. */
export const defaultOperatorWidgetConfigs = {
  "single-value-dashboard-d5ae9f05": {
    "type": "singleValue",
    "deviceName": "PSUEXT1",
    "query": "MEAS:VOLT? CH1",
    "frequencyHz": 1,
    "unit": "V",
    "cardName": "CH1 Voltage",
    "valueColor": "#ffa200"
  },
  "chart-dashboard-medium-92201d6a": {
    "type": "chart",
    "cardName": "CH1 VOLTAGE",
    "unit": "V",
    "frequencyHz": 2.5,
    "historyLimitBytes": 262144,
    "series": [
      {
        "id": "series-1",
        "label": "Voltage",
        "deviceName": "PSUEXT1",
        "query": "MEAS:VOLT:DATA? CH1",
        "lineColor": "#ffa200"
      }
    ],
    "statistics": {
      "showStatistics": true,
      "seriesId": "series-1",
      "enabledStats": {
        "count": false,
        "avg": true,
        "median": false,
        "min": true,
        "max": true,
        "ripplePeakToPeak": true,
        "rippleRms": false,
        "typicalRippleP95P5": false,
        "stdDev": false,
        "maxDelta": false,
        "avgDelta": false,
        "trendPerSecond": false,
        "drift": false,
        "spikeCount": false,
        "frequencyHz": false,
        "periodSeconds": false
      }
    }
  },
  "single-toggle-dashboard-15d34293": {
    "type": "singleToggle",
    "deviceName": "PSUEXT1",
    "statusCommand": "OUTP? CH1",
    "onCommand": "OUTP CH1, 1",
    "offCommand": "OUTP CH1, 0",
    "onResponse": "1",
    "offResponse": "0",
    "cardName": "Output Control",
    "statusColor": "#ff1414",
    "autoRefreshEnabled": true,
    "refreshFrequencyHz": 1
  },
  "single-value-dashboard-b5ee19ab": {
    "type": "singleValue",
    "deviceName": "PSUEXT1",
    "query": "MEAS:CURR? CH1",
    "frequencyHz": 1,
    "unit": "A",
    "cardName": "CH1 Current",
    "valueColor": "#ff1414"
  },
  "single-value-dashboard-662da800": {
    "type": "singleValue",
    "deviceName": "PSUEXT1",
    "query": "MEAS:POWER? CH1",
    "frequencyHz": 1,
    "unit": "W",
    "cardName": "CH1 Power",
    "valueColor": "#2563eb"
  },
  "chart-dashboard-medium-89311ca7": {
    "type": "chart",
    "cardName": "CH1 Power",
    "unit": "W",
    "frequencyHz": 1,
    "historyLimitBytes": 262144,
    "series": [
      {
        "id": "series-1",
        "label": "Power",
        "deviceName": "PSUEXT1",
        "query": "MEAS:POWER:DATA? 1",
        "lineColor": "#2563eb"
      }
    ],
    "statistics": {
      "showStatistics": true,
      "seriesId": "series-1",
      "enabledStats": {
        "count": false,
        "avg": true,
        "median": false,
        "min": true,
        "max": true,
        "ripplePeakToPeak": true,
        "rippleRms": false,
        "typicalRippleP95P5": false,
        "stdDev": false,
        "maxDelta": false,
        "avgDelta": false,
        "trendPerSecond": false,
        "drift": false,
        "spikeCount": false,
        "frequencyHz": false,
        "periodSeconds": false
      }
    }
  },
  "chart-dashboard-medium-59f9bf7b": {
    "type": "chart",
    "cardName": "CH0 Voltage",
    "unit": "V",
    "frequencyHz": 2.5,
    "historyLimitBytes": 262144,
    "series": [
      {
        "id": "series-1",
        "label": "Voltage",
        "deviceName": "PSUEXT1",
        "query": "MEAS:VOLT:DATA? CH0",
        "lineColor": "#d715d7"
      }
    ],
    "statistics": {
      "showStatistics": true,
      "seriesId": "series-1",
      "enabledStats": {
        "count": false,
        "avg": true,
        "median": false,
        "min": true,
        "max": true,
        "ripplePeakToPeak": true,
        "rippleRms": false,
        "typicalRippleP95P5": false,
        "stdDev": false,
        "maxDelta": false,
        "avgDelta": false,
        "trendPerSecond": false,
        "drift": false,
        "spikeCount": false,
        "frequencyHz": false,
        "periodSeconds": false
      }
    }
  },
  "single-value-dashboard-b015f2a7": {
    "type": "singleValue",
    "deviceName": "PSUEXT1",
    "query": "MEAS:VOLT? CH0",
    "frequencyHz": 1,
    "unit": "V",
    "cardName": "CH0 Voltage",
    "valueColor": "#d715d7"
  },
  "protection-dashboard-05af8ac2": {
    "type": "protectionControl",
    "deviceName": "PSUEXT1",
    "cardName": "OCP CH1",
    "valueColor": "#0f766e",
    "unit": "A",
    "channel": "CH1",
    "protectionKey": "OCP",
    "frequencyHz": 1,
    "valueQuery": "OCP? CH1",
    "valueSetTemplate": "OCP CH1,{value}",
    "tripQuery": "OCP:PROTect:STATe? CH1",
    "enableQuery": "OCP:STATe? CH1",
    "enableOnCommand": "OCP:STATe CH1,1",
    "enableOffCommand": "OCP:STATe CH1,0",
    "enabledResponse": "1",
    "disabledResponse": "0",
    "minValue": 0,
    "maxValue": 9999.9999,
    "decimals": 4
  },
  "single-value-dashboard-d8d35a2c": {
    "type": "singleValue",
    "deviceName": "PSUEXT1",
    "query": "MEAS:CURR:REL? CH1",
    "frequencyHz": 1,
    "unit": "A",
    "cardName": "Current Rel",
    "valueColor": "#ff1414",
    "setValueEnabled": true,
    "setValueCommand": "MEAS:CURR:REL CH1, {value}",
    "defaultValue": "0.0000"
  },
  "single-value-dashboard-982930ac": {
    "type": "singleValue",
    "deviceName": "PSUEXT1",
    "query": "MEAS:ADC:RATE?",
    "frequencyHz": 5,
    "unit": "SPS",
    "cardName": "ADC RATE",
    "valueColor": "#0f766e",
    "setValueEnabled": true,
    "setValueCommand": "MEAS:ADC:RATE {value}",
    "defaultValue": "128"
  },
  "chart-dashboard-medium-36f644fa": {
    "type": "chart",
    "cardName": "CH1 Current",
    "unit": "A",
    "frequencyHz": 1,
    "historyLimitBytes": 262144,
    "series": [
      {
        "id": "series-1",
        "label": "Currant",
        "deviceName": "PSUEXT1",
        "query": "MEAS:CURR:DATA? CH1",
        "lineColor": "#ff1414"
      }
    ],
    "statistics": {
      "showStatistics": true,
      "seriesId": "series-1",
      "enabledStats": {
        "count": false,
        "avg": true,
        "median": false,
        "min": true,
        "max": true,
        "ripplePeakToPeak": true,
        "rippleRms": false,
        "typicalRippleP95P5": false,
        "stdDev": false,
        "maxDelta": false,
        "avgDelta": false,
        "trendPerSecond": false,
        "drift": false,
        "spikeCount": false,
        "frequencyHz": false,
        "periodSeconds": false
      }
    }
  }
};
