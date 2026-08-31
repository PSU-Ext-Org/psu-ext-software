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
import { Clock3, Pause, Play, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useWebSocketConnection } from "../../../../connection/ws-proxy/WebSocketConnectionContext.jsx";
import {
  DEFAULT_TIMER_QUEUE_CONTROL_CONFIG,
  getTimerQueueConfigLimits,
  getTimerQueueValidationIssue,
  saveTimerQueueControlConfig,
  useTimerQueueControlConfig,
  validateTimerQueueControlConfig,
} from "../timerQueueConfig.js";
import { useTimerQueueRuntime } from "../hooks/useTimerQueueRuntime.js";
import {
  formatRemaining,
  getTimerActionLabel,
  getTimerQueueHelperText,
  RUNNING_TIMER_STATE,
} from "../utils/timerQueueRuntime.js";
import { TimerQueueEditor } from "./TimerQueueEditor.jsx";
import { TimerQueueInfoButton } from "./TimerQueueInfoButton.jsx";
import { TimerQueueSettingsButton } from "./TimerQueueSettingsButton.jsx";

export function TimerQueueCardTitle({ placement }) {
  const [config] = useTimerQueueControlConfig(placement.id);

  return <>{config.cardName || DEFAULT_TIMER_QUEUE_CONTROL_CONFIG.cardName}</>;
}

export function TimerQueueCardActions({ placement }) {
  return (
    <>
      <TimerQueueInfoButton />
      <TimerQueueSettingsButton iconOnly placement={placement} />
    </>
  );
}

export function TimerQueueCard({ placement }) {
  const { wsConnected, devices = [], deviceStatuses = {}, sendScpiCommand = missingSendScpiCommand } = useWebSocketConnection();
  const [config, setConfig] = useTimerQueueControlConfig(placement.id);
  const [draftTimers, setDraftTimers] = useState(config.timers);
  const deviceByName = useMemo(
    () => new Map(devices.map((candidate) => [candidate.name, candidate])),
    [devices],
  );
  const device = deviceByName.get(config.deviceName);
  const deviceConnected = Boolean(device && deviceStatuses[device.id]?.state === "CONNECTED");
  const runnable = Boolean(wsConnected && device && deviceConnected && config.deviceName);
  const validationError = validateTimerQueueControlConfig(config);
  const draftValidation = getTimerQueueValidationIssue({ ...config, timers: draftTimers });
  const dirty = JSON.stringify(config.timers) !== JSON.stringify(draftTimers);
  const { displayedRemainingMs, handleTimerAction, progressPercent, refreshStatus, runtime } = useTimerQueueRuntime({
    config,
    device,
    runnable,
    sendScpiCommand,
    wsConnected,
  });
  const actionDisabled =
    !runnable ||
    runtime.loading ||
    Boolean(validationError) ||
    (runtime.state === RUNNING_TIMER_STATE && runtime.desynced);

  useEffect(() => {
    setDraftTimers(config.timers);
  }, [config.timers]);

  const helperText = getTimerQueueHelperText({
    config,
    device,
    deviceConnected,
    runtime,
    validationError,
    wsConnected,
  });
  const actionLabel = getTimerActionLabel(runtime);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      {!config.deviceName ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Configure a target device for this timer queue widget.
        </p>
      ) : null}

      <div className="grid gap-3 rounded-md bg-slate-100 px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">
              Current timer
            </p>
            <div className="flex min-w-0 items-baseline gap-3">
              <p className="truncate text-3xl font-semibold leading-tight text-slate-900" data-testid={`timer-active-${placement.id}`}>
                {runtime.activeId === "NONE" ? "--" : runtime.activeId}
              </p>
              <p className="truncate text-sm font-medium text-slate-600">
                {runtime.desynced ? "Out of sync" : runtime.state}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              aria-label="Refresh timer status"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!runnable || runtime.loading}
              onClick={() => {
                void refreshStatus();
              }}
              type="button"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              aria-label={actionLabel}
              className="control-standard inline-flex items-center justify-center gap-2 bg-teal-700 font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={actionDisabled}
              onClick={() => {
                void handleTimerAction();
              }}
              type="button"
            >
              {runtime.state === RUNNING_TIMER_STATE ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {actionLabel}
            </button>
          </div>
        </div>

        <div className="grid gap-1">
          <div className="flex min-w-0 justify-between gap-3 text-sm text-slate-600">
            <span className="truncate">Remaining</span>
            <div className="flex min-w-0 items-end justify-end gap-3">
              <span className="truncate text-xs text-slate-500">
                {runtime.queueLoaded ? "Loaded on device" : config.timers.length ? "Preset not loaded" : "No timers configured"}
              </span>
              <span className="truncate text-xs text-slate-500">
                {progressPercent == null ? (runtime.desynced ? "Progress unavailable" : "Awaiting sync") : `${Math.round(progressPercent)}%`}
              </span>
              <strong className="truncate text-right leading-[1.25] text-slate-900">
                {formatRemaining(displayedRemainingMs)}
              </strong>
            </div>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-slate-200">
            <div
              aria-label="Timer progress"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={progressPercent == null ? undefined : Math.round(progressPercent)}
              className={[
                "h-full rounded-full transition-[width] duration-200",
                runtime.desynced ? "bg-amber-500" : "bg-teal-600",
              ].join(" ")}
              role="progressbar"
              style={{ width: `${progressPercent == null ? 100 : progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <TimerQueueEditor
        config={config}
        dirty={dirty}
        draftTimers={draftTimers}
        draftValidation={draftValidation}
        helperText={helperText}
        onAddTimer={(timer) => {
          setDraftTimers((current) => [...current, timer]);
        }}
        onDeleteTimer={(index) => {
          setDraftTimers((current) => current.filter((_, timerIndex) => timerIndex !== index));
        }}
        onSavePreset={() => {
          setConfig(saveTimerQueueControlConfig(placement.id, { ...config, timers: draftTimers }));
        }}
        onUpdateTimer={updateDraftTimer}
      />

      {!config.deviceName ? (
        <div className="shrink-0">
          <TimerQueueSettingsButton placement={placement} timers={draftTimers} />
        </div>
      ) : null}
    </div>
  );

  function updateDraftTimer(index, key, value) {
    setDraftTimers((current) => current.map((timer, timerIndex) => (
      timerIndex === index ? { ...timer, [key]: key === "id" ? String(value).slice(0, getTimerQueueConfigLimits().timerIdLength) : value } : timer
    )));
  }
}

function missingSendScpiCommand() {
  return Promise.reject(new Error("SCPI command sender is unavailable."));
}

export const TimerQueueIcon = Clock3;
