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
import { SlidingToggle } from "../../../forms/SlidingToggle.jsx";
import { ValidationMessage } from "../../../forms/ValidationMessage.jsx";
import { ChartImageExportButton, ChartStatisticsSettings } from "../../chart/index.js";
import { useWebSocketConnection } from "../../../../connection/ws-proxy/WebSocketConnectionContext.jsx";
import { connectedDevices } from "../../../../connection/ws-proxy/device/deviceRegistry.js";
import { MAX_CHART_HISTORY_BYTES } from "../../chart/storage/chartHistoryStorage.js";
import { deleteXyChartHistory } from "../storage/xyChartHistoryStorage.js";
import { validateXyChartDraft } from "../utils/xyChartStatus.js";
import { getXyStatisticsSeries, saveXyChartConfig, useXyChartConfig } from "../xyChartConfig.js";
import { XyAxisFields } from "./XyAxisFields.jsx";
import { XyPairTimeoutInfoButton } from "./XyPairTimeoutInfoButton.jsx";

const INPUT_CLASS =
  "control-standard w-full border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700";
const ICON_BUTTON_CLASS =
  "inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50";

/**
 * Header actions for a persisted X-Y chart instance: clear its stored history, export a PNG and open settings.
 *
 * @param {{placement: {id: string}}} props
 * @returns {import("react").ReactElement}
 */
export function XyChartCardActions({ placement }) {
  return (
    <>
      <button
        aria-label="Clear X-Y chart history"
        className={ICON_BUTTON_CLASS}
        onClick={() => deleteXyChartHistory(placement.id)}
        onPointerDown={(event) => event.stopPropagation()}
        type="button"
      >
        <Eraser className="h-4 w-4" />
        <span className="sr-only">Clear history</span>
      </button>
      <ChartImageExportButton exportId={placement.id} />
      <XyChartSettingsButton placement={placement} />
    </>
  );
}

function XyChartSettingsButton({ placement }) {
  const { devices = [], deviceStatuses = {} } = useWebSocketConnection();
  const [config, setConfig] = useXyChartConfig(placement.id);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(config);
  const dialogRef = useModalDialog(open, () => setOpen(false));
  const connectedTargets = useMemo(() => connectedDevices(devices, deviceStatuses), [devices, deviceStatuses]);
  const deviceOptions = useMemo(() => (devices.length ? devices : connectedTargets), [connectedTargets, devices]);
  const errors = useMemo(() => validateXyChartDraft(draft), [draft]);

  useEffect(() => {
    if (!open) {
      setDraft(config);
    }
  }, [config, open]);

  return (
    <>
      <button
        aria-label="Configure X-Y chart card"
        className={ICON_BUTTON_CLASS}
        onClick={() => setOpen(true)}
        onPointerDown={(event) => event.stopPropagation()}
        type="button"
      >
        <Settings className="h-4 w-4" />
        <span className="sr-only">Configure</span>
      </button>

      {open ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6"
          onPointerDown={(event) => event.stopPropagation()}
          ref={dialogRef}
          role="dialog"
        >
          <form
            className="grid max-h-[calc(100vh-3rem)] w-full max-w-lg gap-4 overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              if (errors.length) {
                return;
              }

              setConfig(saveXyChartConfig(placement.id, draft));
              setOpen(false);
            }}
          >
            <div className="flex min-w-0 items-start justify-between gap-4">
              <h3 className="text-lg font-semibold text-slate-950">X-Y Chart Settings</h3>
              <button
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <XyAxisFields axis="x" deviceOptions={deviceOptions} onChange={(key, value) => updateAxis("x", key, value)} value={draft.x} />
            <XyAxisFields axis="y" deviceOptions={deviceOptions} onChange={(key, value) => updateAxis("y", key, value)} value={draft.y} />

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Frequency (Hz)
                <input
                  className={INPUT_CLASS}
                  max="100"
                  min="0.1"
                  onChange={(event) => updateDraft("frequencyHz", event.target.value)}
                  step="0.1"
                  type="number"
                  value={draft.frequencyHz}
                />
              </label>
              <div className="grid gap-1.5 text-sm font-medium text-slate-700">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="xy-pair-timeout">Pair timeout (ms)</label>
                  <XyPairTimeoutInfoButton />
                </div>
                <input
                  className={INPUT_CLASS}
                  id="xy-pair-timeout"
                  onChange={(event) => updateDraft("pairTimeoutMs", event.target.value)}
                  step="50"
                  type="number"
                  value={draft.pairTimeoutMs}
                />
              </div>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                History cap (KiB)
                <input
                  className={INPUT_CLASS}
                  max={MAX_CHART_HISTORY_BYTES / 1024}
                  min="1"
                  onChange={(event) => updateDraft("historyLimitBytes", kibToBytes(event.target.value))}
                  step="1"
                  type="number"
                  value={bytesToKiBValue(draft.historyLimitBytes)}
                />
              </label>
            </div>
            <p className="-mt-2 text-xs text-slate-500">
              Local chart history storage. When the cap is reached, the oldest points are discarded first.
            </p>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem]">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Card name
                <input
                  className={INPUT_CLASS}
                  onChange={(event) => updateDraft("cardName", event.target.value)}
                  placeholder="I-V Curve"
                  value={draft.cardName}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Color
                <input
                  className="h-8 w-full rounded-md border border-slate-300 bg-white p-1"
                  onChange={(event) => updateDraft("lineColor", event.target.value)}
                  type="color"
                  value={draft.lineColor}
                />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                checked={draft.showLine}
                onChange={(event) => updateDraft("showLine", event.target.checked)}
                type="checkbox"
              />
              Connect points with a line
            </label>

            <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="grid gap-0.5">
                  <span className="text-sm font-medium text-slate-700">Show X·Y line</span>
                  <span className="text-xs text-slate-500">Plot X·Y against X on a right-hand axis.</span>
                </div>
                <SlidingToggle
                  ariaLabel="Show X·Y line"
                  checked={draft.showProduct}
                  onClick={() => updateDraft("showProduct", !draft.showProduct)}
                />
              </div>
              {draft.showProduct ? (
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem_6rem]">
                  <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                    X·Y label
                    <input
                      className={INPUT_CLASS}
                      onChange={(event) => updateProduct("label", event.target.value)}
                      placeholder="Power"
                      value={draft.product.label}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                    X·Y unit
                    <input
                      className={INPUT_CLASS}
                      onChange={(event) => updateProduct("unit", event.target.value)}
                      placeholder="W"
                      value={draft.product.unit}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                    X·Y color
                    <input
                      className="h-8 w-full rounded-md border border-slate-300 bg-white p-1"
                      onChange={(event) => updateDraft("productColor", event.target.value)}
                      type="color"
                      value={draft.productColor}
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <ChartStatisticsSettings
              idPrefix="xy-chart-stat"
              onChange={(statistics) => updateDraft("statistics", statistics)}
              series={getXyStatisticsSeries(draft)}
              statistics={draft.statistics}
            />

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
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateProduct(key, value) {
    setDraft((current) => ({ ...current, product: { ...current.product, [key]: value } }));
  }

  function updateAxis(axis, key, value) {
    setDraft((current) => ({ ...current, [axis]: { ...current[axis], [key]: value } }));
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
