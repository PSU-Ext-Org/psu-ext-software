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
import { Save, Workflow } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useWebSocketConnection } from "../../../../connection/ws-proxy/WebSocketConnectionContext.jsx";
import { useExternalTriggerRuntime } from "../hooks/useExternalTriggerRuntime.js";
import { useExternalTriggerControlConfig } from "../triggerConfig.js";
import { ExternalTriggerSettings } from "./ExternalTriggerSettings.jsx";
import {
  buildSelectOptions,
  getExternalTriggerCardName,
  getSlotDisplayValue,
  getStatusText,
  TRIGGER_SLOT_DEFINITIONS,
  validateRunnableConfig,
} from "../utils/triggerHelpers.js";

export function ExternalTriggerControlTitle({ placement }) {
  const [config] = useExternalTriggerControlConfig(placement.id);

  return <>{getExternalTriggerCardName(config)}</>;
}

export function ExternalTriggerControlActions({ placement }) {
  return <ExternalTriggerSettings iconOnly placement={placement} />;
}

export function ExternalTriggerControlCard({ placement }) {
  const {
    wsConnected,
    devices = [],
    deviceStatuses = {},
    sendScpiCommand,
  } = useWebSocketConnection();
  const [config] = useExternalTriggerControlConfig(placement.id);
  const validationError = validateRunnableConfig(config);
  const deviceByName = useMemo(
    () => new Map(devices.map((candidate) => [candidate.name, candidate])),
    [devices],
  );
  const device = deviceByName.get(config.deviceName);
  const deviceConnected = Boolean(device && deviceStatuses[device.id]?.state === "CONNECTED");
  const runnable = !validationError && wsConnected && device && deviceConnected;
  const { runtime, saveSlots } = useExternalTriggerRuntime({
    config,
    runnable,
    sendScpiCommand,
  });
  const [draftSlots, setDraftSlots] = useState(runtime.slots);
  const groupedSlots = useMemo(
    () => ({
      T1: TRIGGER_SLOT_DEFINITIONS.filter((slot) => slot.triggerLabel === "T1"),
      T2: TRIGGER_SLOT_DEFINITIONS.filter((slot) => slot.triggerLabel === "T2"),
    }),
    [],
  );
  const statusText = getStatusText({ device, deviceConnected, runtime, validationError, wsConnected });
  const dirtySlotKeys = useMemo(
    () => TRIGGER_SLOT_DEFINITIONS
      .filter((slot) => draftSlots[slot.key] !== runtime.slots[slot.key])
      .map((slot) => slot.key),
    [draftSlots, runtime.slots],
  );
  const dirty = dirtySlotKeys.length > 0;

  useEffect(() => {
    setDraftSlots(runtime.slots);
  }, [runtime.lastUpdatedAt, runtime.slots]);

  if (!config.deviceName || !config.statusQueryTemplate || !config.setupCommandTemplate) {
    return (
      <div className="flex min-h-full flex-col gap-3">
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Configure trigger queries, setup command, and action options.
        </p>
        <div className="mt-auto">
          <ExternalTriggerSettings placement={placement} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-3">
      <div className="grid gap-2 rounded-md bg-slate-100 px-3 py-3">
        {Object.entries(groupedSlots).map(([groupLabel, slots]) => (
          <div className="grid gap-1.5" key={groupLabel}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{groupLabel}</span>
              <span className="text-[11px] text-slate-500">{groupLabel === "T1" ? "IO5" : "IO4"}</span>
            </div>
            {slots.map((slot) => {
              const slotValue = draftSlots[slot.key];
              const slotDisplay = getSlotDisplayValue(slotValue, config.actionOptions, config.clearTriggerValue);
              const selectOptions = buildSelectOptions(config.actionOptions, slotValue, config.clearTriggerValue);

              return (
                <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(8rem,1.1fr)] items-center gap-2" key={slot.key}>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-600">{slot.label}</p>
                    <p className="truncate text-[11px] text-slate-500" title={slotDisplay.commandLabel}>
                      {slotDisplay.commandLabel}
                    </p>
                  </div>
                  <select
                    aria-label={`${slot.triggerLabel} ${slot.label} action`}
                    className="control-standard w-full min-w-0 border border-slate-300 bg-white text-sm text-slate-950 outline-none focus:border-teal-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                    disabled={!runnable || runtime.loading}
                    onChange={(event) => {
                      setDraftSlots((current) => ({
                        ...current,
                        [slot.key]: event.target.value,
                      }));
                    }}
                    value={slotDisplay.selectValue}
                  >
                    {selectOptions.map((option) => (
                      <option key={`${slot.key}-${option.value}`} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-auto grid gap-1 text-xs text-slate-600">
        <button
          aria-label="Save trigger configuration"
          className="control-standard mb-2 inline-flex w-full items-center justify-center gap-2 bg-teal-700 font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!runnable || runtime.loading || !dirty}
          onClick={() => {
            const changedSlots = dirtySlotKeys.reduce((accumulator, slotKey) => ({
              ...accumulator,
              [slotKey]: draftSlots[slotKey],
            }), {});
            void saveSlots(changedSlots);
          }}
          type="button"
        >
          <Save className="h-4 w-4" />
          Save
        </button>

        <div className="flex min-w-0 justify-between gap-3">
          <span className="truncate">
            <span className="text-slate-500">Target:</span> {config.deviceName}
          </span>
          <strong className="truncate text-right">
            {runtime.loading ? "Applying" : dirty ? "Unsaved changes" : "Ready"}
          </strong>
        </div>
        <div className="flex min-w-0 justify-between gap-3">
          <span className="truncate">
            <span className="text-slate-500">Actions:</span> {config.actionOptions.length}
          </span>
          <strong className="truncate text-right">{statusText}</strong>
        </div>
      </div>
    </div>
  );
}

export const ExternalTriggerControlIcon = Workflow;
