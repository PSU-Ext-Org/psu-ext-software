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
import { Pause, Play, RefreshCw } from "lucide-react";
import { formatRemaining, RUNNING_TIMER_STATE } from "../utils/timerQueueStatus.js";

/**
 * Displays the active timer, synchronization state, progress, and runtime controls.
 *
 * @param {{
 *   controls: {
 *     actionDisabled: boolean,
 *     actionLabel: string,
 *     onAction: () => Promise<void> | void,
 *     onRefresh: () => Promise<void> | void,
 *     refreshDisabled: boolean,
 *   },
 *   displayedRemainingMs: number,
 *   presetTimerCount: number,
 *   progressPercent: number | null,
 *   runtime: {
 *     activeId: string,
 *     desynced: boolean,
 *     queueLoaded: boolean,
 *     state: string,
 *   },
 *   widgetId: string,
 * }} props - Runtime presentation model and actions.
 * @returns {import("react").ReactElement} Timer runtime status panel.
 */
export function TimerQueueStatusPanel({
  controls,
  displayedRemainingMs,
  presetTimerCount,
  progressPercent,
  runtime,
  widgetId,
}) {
  const activeIdLabel = runtime.activeId === "NONE" ? "--" : runtime.activeId;
  const runtimeStateLabel = runtime.desynced ? "Out of sync" : runtime.state;
  const presetStatusLabel = getPresetStatusLabel(runtime.queueLoaded, presetTimerCount);
  const progressLabel = getProgressLabel(progressPercent, runtime.desynced);
  const progressValue = progressPercent == null ? undefined : Math.round(progressPercent);
  const progressWidth = `${progressPercent == null ? 100 : progressPercent}%`;
  const progressColor = runtime.desynced ? "bg-amber-500" : "bg-teal-600";
  const actionIcon = runtime.state === RUNNING_TIMER_STATE
    ? <Pause className="h-4 w-4" />
    : <Play className="h-4 w-4" />;

  return (
    <div className="grid gap-3 rounded-md bg-slate-100 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">
            Current timer
          </p>
          <div className="flex min-w-0 items-baseline gap-3">
            <p
              className="truncate text-3xl font-semibold leading-tight text-slate-900"
              data-testid={`timer-active-${widgetId}`}
            >
              {activeIdLabel}
            </p>
            <p className="truncate text-sm font-medium text-slate-600">
              {runtimeStateLabel}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            aria-label="Refresh timer status"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={controls.refreshDisabled}
            onClick={handleRefresh}
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            aria-label={controls.actionLabel}
            className="control-standard inline-flex items-center justify-center gap-2 bg-teal-700 font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={controls.actionDisabled}
            onClick={handleAction}
            type="button"
          >
            {actionIcon}
            {controls.actionLabel}
          </button>
        </div>
      </div>

      <div className="grid gap-1">
        <div className="flex min-w-0 justify-between gap-3 text-sm text-slate-600">
          <span className="truncate">Remaining</span>
          <div className="flex min-w-0 items-end justify-end gap-3">
            <span className="truncate text-xs text-slate-500">
              {presetStatusLabel}
            </span>
            <span className="truncate text-xs text-slate-500">
              {progressLabel}
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
            aria-valuenow={progressValue}
            className={`h-full rounded-full transition-[width] duration-200 ${progressColor}`}
            role="progressbar"
            style={{ width: progressWidth }}
          />
        </div>
      </div>
    </div>
  );

  function handleRefresh() {
    void controls.onRefresh();
  }

  function handleAction() {
    void controls.onAction();
  }
}

function getPresetStatusLabel(queueLoaded, presetTimerCount) {
  if (queueLoaded) {
    return "Loaded on device";
  }

  return presetTimerCount ? "Preset not loaded" : "No timers configured";
}

function getProgressLabel(progressPercent, desynced) {
  if (progressPercent != null) {
    return `${Math.round(progressPercent)}%`;
  }

  return desynced ? "Progress unavailable" : "Awaiting sync";
}
