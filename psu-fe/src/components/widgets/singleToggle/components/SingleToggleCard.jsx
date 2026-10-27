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
import { Power } from "lucide-react";
import { DEFAULT_SINGLE_TOGGLE_CONFIG, useSingleToggleConfig } from "../singleToggleConfig.js";
import { useSingleToggleRuntime } from "../hooks/useSingleToggleRuntime.js";
import { SingleToggleSettingsButton } from "./SingleToggleSettingsButton.jsx";

/**
 * Dynamic dashboard title for a persisted SingleToggleCard instance.
 *
 * @param {{placement: {id: string}}} props
 * @returns {import("react").ReactElement}
 */
export function SingleToggleCardTitle({ placement }) {
  const [config] = useSingleToggleConfig(placement.id);

  return <>{config.cardName || DEFAULT_SINGLE_TOGGLE_CONFIG.cardName}</>;
}

/**
 * Header action for configuring a persisted SingleToggleCard instance.
 *
 * @param {{placement: {id: string}}} props
 * @returns {import("react").ReactElement}
 */
export function SingleToggleCardActions({ placement }) {
  return <SingleToggleSettingsButton iconOnly placement={placement} />;
}

/**
 * 1x1 dashboard widget that controls a binary SCPI state.
 *
 * @param {{placement: {id: string}}} props
 * @returns {import("react").ReactElement}
 */
export function SingleToggleCard({ placement }) {
  const [config] = useSingleToggleConfig(placement.id);
  const { status, displayText, helperText, actionLabel, actionDisabled, handleToggle } =
    useSingleToggleRuntime({ placement, config });

  if (!config.deviceName || !config.statusCommand || !config.onCommand || !config.offCommand) {
    return (
      <div className="flex min-h-full flex-col gap-3">
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Configure a target device and toggle commands.
        </p>
        <div className="mt-auto">
          <SingleToggleSettingsButton placement={placement} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-3">
      <button
        className="min-w-0 rounded-md bg-slate-100 px-3 py-3 text-left transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
        data-testid={`single-toggle-${placement.id}`}
        disabled={actionDisabled}
        onClick={handleToggle}
        type="button"
      >
        <span
          className="block truncate text-3xl font-semibold leading-tight"
          style={{ color: status.state === "unknown" ? "#475569" : config.statusColor }}
        >
          {displayText}
        </span>
        <span className="mt-1 block truncate text-sm font-medium text-slate-600">{actionLabel}</span>
      </button>
      <div className="mt-auto grid gap-1 text-xs text-slate-600">
        <div className="flex min-w-0 justify-between gap-3">
          <span className="shrink-0">Target</span>
          <strong className="min-w-0 truncate text-right">{config.deviceName}</strong>
        </div>
        <div className="flex min-w-0 justify-between gap-3">
          <span className="shrink-0">Status</span>
          <strong className="min-w-0 truncate text-right">{helperText}</strong>
        </div>
      </div>
    </div>
  );

}

export const SingleToggleIcon = Power;
