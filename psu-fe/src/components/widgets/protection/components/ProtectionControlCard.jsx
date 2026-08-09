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
import { AlertTriangle, Save } from "lucide-react";
import { useMemo } from "react";
import { useWebSocketConnection } from "../../../../connection/ws-proxy/WebSocketConnectionContext.jsx";
import { InputValidationPopover } from "../../../forms/InputValidationPopover.jsx";
import { SlidingToggle } from "../../../forms/SlidingToggle.jsx";
import { hasEnableSupport } from "../utils/protectionHelpers.js";
import { useProtectionControlConfig } from "../protectionConfig.js";
import { ProtectionSettings } from "./ProtectionSettings.jsx";
import { useProtectionRuntime } from "../hooks/useProtectionRuntime.js";
import {
  formatDisplayThreshold,
  getEnableText,
  getProtectionCardName,
  getStatusText,
  getTripText,
  getNumericStep,
  validateDraftThreshold,
  validateRunnableConfig,
} from "../utils/protectionHelpers.js";

/**
 * Dynamic dashboard title for a persisted protection-control widget instance.
 *
 * @param {{placement: {id: string}}} props
 * @returns {import("react").ReactElement}
 */
export function ProtectionControlTitle({ placement }) {
  const [config] = useProtectionControlConfig(placement.id);

  return <>{getProtectionCardName(config)}</>;
}

/**
 * Header action for configuring a persisted protection-control widget instance.
 *
 * @param {{placement: {id: string}}} props
 * @returns {import("react").ReactElement}
 */
export function ProtectionControlActions({ placement }) {
  return <ProtectionSettings iconOnly placement={placement} />;
}

/**
 * Compact dashboard widget for configurable OVP/OCP-style threshold controls.
 *
 * @param {{placement: {id: string}}} props
 * @returns {import("react").ReactElement}
 */
export function ProtectionControlCard({ placement }) {
  const {
    wsConnected,
    devices = [],
    deviceStatuses = {},
    sendScpiCommand,
  } = useWebSocketConnection();
  const [config] = useProtectionControlConfig(placement.id);
  const validationError = validateRunnableConfig(config);
  const deviceByName = useMemo(
    () => new Map(devices.map((candidate) => [candidate.name, candidate])),
    [devices],
  );
  const device = deviceByName.get(config.deviceName);
  const deviceConnected = Boolean(device && deviceStatuses[device.id]?.state === "CONNECTED");
  const runnable = !validationError && wsConnected && device && deviceConnected;
  const { draftValue, handleApplyThreshold, handleToggleEnabled, runtime, setDraftValue } =
    useProtectionRuntime({
      config,
      placementId: placement.id,
      runnable,
      sendScpiCommand,
    });
  const inputError = validateDraftThreshold(draftValue, config, runtime.loading);
  const showEnableControl = hasEnableSupport(config);
  const statusText = getStatusText({ device, deviceConnected, runtime, validationError, wsConnected });
  const thresholdText = formatDisplayThreshold(runtime.thresholdValue, config.decimals);
  const tripText = getTripText(runtime.tripped);
  const enableText = getEnableText(runtime.enabledState);

  if (!config.deviceName || !config.valueQuery || !config.valueSetTemplate || !config.tripQuery) {
    return (
      <div className="flex min-h-full flex-col gap-3">
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Configure protection value, trip, and optional enable commands.
        </p>
        <div className="mt-auto">
          <ProtectionSettings placement={placement} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-3">
      <div className="rounded-md bg-slate-100 px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-3xl font-semibold leading-tight text-slate-900"
              data-testid={`protection-value-${placement.id}`}
              style={{ color: config.valueColor }}
            >
              {thresholdText}
            </p>
          </div>
          <span
            className={[
              "inline-flex rounded-full px-2 py-1 text-xs font-semibold",
              runtime.tripped === true
                ? "bg-rose-100 text-rose-800"
                : "bg-emerald-100 text-emerald-800",
            ].join(" ")}
          >
            {tripText}
          </span>
        </div>
        <form
          className="mt-1 flex w-full items-center justify-between gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void handleApplyThreshold();
          }}
        >
          <span className="min-w-0 truncate text-sm font-medium text-slate-600">{config.unit || "\u00a0"}</span>
          <div className="ml-auto flex shrink-0 items-center justify-end gap-1">
            {showEnableControl ? (
              <SlidingToggle
                ariaLabel={runtime.enabledState === "enabled" ? "Disable protection" : "Enable protection"}
                checked={runtime.enabledState === "enabled"}
                disabled={!runnable || runtime.loading || runtime.enabledState === "unknown"}
                onClick={() => void handleToggleEnabled()}
              />
            ) : null}
            <div className="relative">
              <input
                aria-label="Protection threshold"
                className={[
                  "h-7 w-20 rounded-md bg-white px-1.5 text-xs text-slate-950 outline-none",
                  inputError
                    ? "border border-rose-500 focus:border-rose-600"
                    : "border border-slate-300 focus:border-teal-700",
                ].join(" ")}
                disabled={!runnable || runtime.loading}
                id={`protection-threshold-${placement.id}`}
                name={`protection-threshold-${placement.id}`}
                onChange={(event) => setDraftValue(event.target.value)}
                placeholder="Set"
                step={getNumericStep(config.decimals)}
                type="number"
                value={draftValue}
              />
              <InputValidationPopover message={inputError} />
            </div>
            <button
              aria-label="Apply threshold"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50"
              disabled={!runnable || runtime.loading || !String(draftValue || "").trim() || Boolean(inputError)}
              type="submit"
            >
              <Save className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>

      <div className="mt-auto grid gap-1 text-xs text-slate-600">
        <div className="flex min-w-0 justify-between gap-3">
          <span className="truncate">
            <span className="text-slate-500">Target:</span> {config.deviceName}
          </span>
          <strong className="truncate text-right">
            {config.protectionKey} {config.channel}
          </strong>
        </div>
        <div className="flex min-w-0 justify-between gap-3">
          <span className="truncate">
            <span className="text-slate-500">Enable:</span> {enableText}
          </span>
          <strong className="truncate text-right">{statusText}</strong>
        </div>
      </div>
    </div>
  );
}

export const ProtectionControlIcon = AlertTriangle;
