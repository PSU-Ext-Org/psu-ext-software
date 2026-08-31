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
import { Clock3 } from "lucide-react";
import { useMemo } from "react";
import { useWebSocketConnection } from "../../../../connection/ws-proxy/WebSocketConnectionContext.jsx";
import {
  DEFAULT_TIMER_QUEUE_CONTROL_CONFIG,
  useTimerQueueControlConfig,
  validateTimerQueueControlConfig,
} from "../timerQueueConfig.js";
import { useTimerQueuePresetEditor } from "../hooks/useTimerQueuePresetEditor.js";
import { useTimerQueueRuntime } from "../hooks/useTimerQueueRuntime.js";
import {
  getTimerActionLabel,
  getTimerQueueHelperText,
  RUNNING_TIMER_STATE,
} from "../utils/timerQueueStatus.js";
import { TimerQueueEditor } from "./TimerQueueEditor.jsx";
import { TimerQueueInfoButton } from "./TimerQueueInfoButton.jsx";
import { TimerQueueSettingsButton } from "./TimerQueueSettingsButton.jsx";
import { TimerQueueStatusPanel } from "./TimerQueueStatusPanel.jsx";

/**
 * Displays the persisted timer queue card name in the dashboard header.
 *
 * @param {{placement: {id: string}}} props - Dashboard widget placement.
 * @returns {import("react").ReactElement} Card title content.
 */
export function TimerQueueCardTitle({ placement }) {
  const [config] = useTimerQueueControlConfig(placement.id);

  return <>{config.cardName || DEFAULT_TIMER_QUEUE_CONTROL_CONFIG.cardName}</>;
}

/**
 * Displays timer queue information and settings actions in the dashboard header.
 *
 * @param {{placement: {id: string}}} props - Dashboard widget placement.
 * @returns {import("react").ReactElement} Card header actions.
 */
export function TimerQueueCardActions({ placement }) {
  return (
    <>
      <TimerQueueInfoButton />
      <TimerQueueSettingsButton iconOnly placement={placement} />
    </>
  );
}

/**
 * Coordinates timer-preset editing, device state, and runtime presentation.
 *
 * @param {{placement: {id: string}}} props - Dashboard widget placement.
 * @returns {import("react").ReactElement} Timer queue widget content.
 */
export function TimerQueueCard({ placement }) {
  const { wsConnected, devices = [], deviceStatuses = {}, sendScpiCommand = missingSendScpiCommand } = useWebSocketConnection();
  const [config, setConfig] = useTimerQueueControlConfig(placement.id);
  const presetEditor = useTimerQueuePresetEditor({ config, setConfig, widgetId: placement.id });
  const deviceByName = useMemo(
    () => new Map(devices.map((candidate) => [candidate.name, candidate])),
    [devices],
  );
  const device = deviceByName.get(config.deviceName);
  const deviceConnected = Boolean(device && deviceStatuses[device.id]?.state === "CONNECTED");
  const runnable = Boolean(wsConnected && device && deviceConnected && config.deviceName);
  const validationError = validateTimerQueueControlConfig(config);
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

  const helperText = getTimerQueueHelperText({
    config,
    device,
    deviceConnected,
    runtime,
    validationError,
    wsConnected,
  });
  const actionLabel = getTimerActionLabel(runtime);
  const statusControls = {
    actionDisabled,
    actionLabel,
    onAction: handleTimerAction,
    onRefresh: refreshStatus,
    refreshDisabled: !runnable || runtime.loading,
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      {!config.deviceName ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Configure a target device for this timer queue widget.
        </p>
      ) : null}

      <TimerQueueStatusPanel
        controls={statusControls}
        displayedRemainingMs={displayedRemainingMs}
        presetTimerCount={config.timers.length}
        progressPercent={progressPercent}
        runtime={runtime}
        widgetId={placement.id}
      />

      <TimerQueueEditor
        config={config}
        editor={presetEditor}
        helperText={helperText}
      />

      {!config.deviceName ? (
        <div className="shrink-0">
          <TimerQueueSettingsButton placement={placement} timers={presetEditor.draftTimers} />
        </div>
      ) : null}
    </div>
  );
}

function missingSendScpiCommand() {
  return Promise.reject(new Error("SCPI command sender is unavailable."));
}

/** Dashboard catalog icon for timer queue widgets. */
export const TimerQueueIcon = Clock3;
