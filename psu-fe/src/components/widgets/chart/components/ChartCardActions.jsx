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
import { Eraser, Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useModalDialog } from "../../../layout/hooks/useModalDialog.js";
import { ValidationMessage } from "../../../forms/ValidationMessage.jsx";
import { useWebSocketConnection } from "../../../../connection/ws-proxy/WebSocketConnectionContext.jsx";
import { connectedDevices } from "../../../../connection/ws-proxy/device/deviceRegistry.js";
import {
  DEFAULT_CHART_CONFIG,
  saveChartConfig,
} from "../chartConfig.js";
import { deleteChartHistory, MAX_CHART_HISTORY_BYTES } from "../storage/chartHistoryStorage.js";
import { validateChartDraft } from "../utils/chartStatus.js";
import { useChartConfig } from "../hooks/useChartConfig.js";
import { ChartStatisticsSettings } from "./ChartStatisticsSettings.jsx";

/**
 * Header action for configuring a persisted ChartCard instance.
 *
 * @param {{placement: {id: string}}} props
 * @returns {import("react").ReactElement}
 */
export function ChartCardActions({ placement }) {
  return (
    <>
      <ClearChartHistoryButton placement={placement} />
      <ChartSettingsButton iconOnly placement={placement} />
    </>
  );
}

function ClearChartHistoryButton({ placement }) {
  return (
    <button
      aria-label="Clear chart history"
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
      onClick={() => deleteChartHistory(placement.id)}
      onPointerDown={(event) => event.stopPropagation()}
      type="button"
    >
      <Eraser className="h-4 w-4" />
      <span className="sr-only">Clear history</span>
    </button>
  );
}

function ChartSettingsButton({ iconOnly = false, placement }) {
  const { devices = [], deviceStatuses = {} } = useWebSocketConnection();
  const [config, setConfig] = useChartConfig(placement.id);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(config);
  const dialogRef = useModalDialog(open, () => setOpen(false));
  const connectedTargets = useMemo(
    () => connectedDevices(devices, deviceStatuses),
    [devices, deviceStatuses],
  );
  const deviceOptions = useMemo(
    () => (devices.length ? devices : connectedTargets),
    [connectedTargets, devices],
  );
  const errors = useMemo(() => validateChartDraft(draft), [draft]);
  const draftSeries = draft.series[0] || DEFAULT_CHART_CONFIG.series[0];

  useEffect(() => {
    if (!open) {
      setDraft(config);
    }
  }, [config, open]);

  return (
    <>
      <button
        aria-label={iconOnly ? "Configure chart card" : undefined}
        className={
          iconOnly
            ? "inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
            : "control-standard inline-flex w-full items-center justify-center gap-2 bg-teal-700 font-medium text-white hover:bg-teal-800"
        }
        onClick={() => setOpen(true)}
        onPointerDown={(event) => event.stopPropagation()}
        type="button"
      >
        <Settings className="h-4 w-4" />
        {iconOnly ? <span className="sr-only">Configure</span> : "Configure"}
      </button>

      {open ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6"
          onPointerDown={(event) => event.stopPropagation()}
          role="dialog"
          ref={dialogRef}
        >
          <form
            className="grid max-h-[calc(100vh-3rem)] w-full max-w-lg gap-4 overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              if (errors.length) {
                return;
              }

              setConfig(saveChartConfig(placement.id, draft));
              setOpen(false);
            }}
          >
            <div className="flex min-w-0 items-start justify-between gap-4">
              <h3 className="text-lg font-semibold text-slate-950">Chart Settings</h3>
              <button
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Device
              <select
                className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                onChange={(event) => updateSeriesDraft("deviceName", event.target.value)}
                value={draftSeries.deviceName}
              >
                <option value="">Select device</option>
                {deviceOptions.map((device) => (
                  <option key={device.id} value={device.name}>
                    {device.id} / {device.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              SCPI query
              <input
                className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                onChange={(event) => updateSeriesDraft("query", event.target.value)}
                placeholder="MEAS:VOLT? CH1"
                value={draftSeries.query}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Frequency (Hz)
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  max="100"
                  min="0.1"
                  onChange={(event) => updateDraft("frequencyHz", event.target.value)}
                  step="0.1"
                  type="number"
                  value={draft.frequencyHz}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Unit
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  onChange={(event) => updateDraft("unit", event.target.value)}
                  placeholder="V"
                  value={draft.unit}
                />
              </label>
            </div>

            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              History cap (KiB)
              <input
                aria-label="History cap (KiB)"
                className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                max={MAX_CHART_HISTORY_BYTES / 1024}
                min="1"
                onChange={(event) => updateDraft("historyLimitBytes", kibToBytes(event.target.value))}
                step="1"
                type="number"
                value={bytesToKiBValue(draft.historyLimitBytes)}
              />
              <span className="text-xs font-normal text-slate-500">
                Local chart history storage. When the cap is reached, the oldest samples are discarded first.
              </span>
            </label>

            <ChartStatisticsSettings statistics={draft.statistics} series={draft.series} onChange={(statistics) => updateDraft("statistics", statistics)} />

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem]">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Card name
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  onChange={(event) => updateDraft("cardName", event.target.value)}
                  placeholder="Voltage Chart"
                  value={draft.cardName}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Line label
                <input
                  className="control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700"
                  onChange={(event) => updateSeriesDraft("label", event.target.value)}
                  placeholder="Voltage"
                  value={draftSeries.label}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Color
                <input
                  className="h-8 w-full rounded-md border border-slate-300 bg-white p-1"
                  onChange={(event) => updateSeriesDraft("lineColor", event.target.value)}
                  type="color"
                  value={draftSeries.lineColor}
                />
              </label>
            </div>

            <ValidationMessage message={errors[0]} />

            <div className="flex justify-end gap-2">
              <button
                className="control-standard border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="control-standard bg-teal-700 font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                disabled={errors.length > 0}
                type="submit"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );

  function updateDraft(key, value) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateSeriesDraft(key, value) {
    setDraft((current) => {
      const [firstSeries = DEFAULT_CHART_CONFIG.series[0], ...restSeries] = current.series;
      return {
        ...current,
        series: [{ ...firstSeries, [key]: value }, ...restSeries],
      };
    });
  }

}

function bytesToKiBValue(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? String(Math.round(parsed / 1024)) : "";
}

function kibToBytes(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? String(parsed * 1024) : "";
}
