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
import { useEffect, useMemo, useState } from "react";
import { connectedDevices } from "../../../../connection/ws-proxy/device/deviceRegistry.js";
import { MONITOR_TAG } from "../../../../connection/ws-proxy/monitor/monitorTagQueue.js";

/**
 * Owns the target-device selection and command submission form state.
 *
 * @param {object} options
 * @param {object[]} options.devices - Known device definitions.
 * @param {object} options.deviceStatuses - Current device connection statuses.
 * @param {() => void} options.onCommandSent - Selects only the USER tag after sending.
 * @param {(command: string, targetName: string, options: object) => boolean} options.sendScpiCommand - Sends the command.
 * @param {boolean} options.wsConnected - Whether the WebSocket transport is connected.
 * @returns {object} Command form view model consumed by MonitorCommandForm.
 */
export function useMonitorCommand({
  devices,
  deviceStatuses,
  onCommandSent,
  sendScpiCommand,
  wsConnected,
}) {
  const [commandValue, setCommandValue] = useState("");
  const [targetDeviceName, setTargetDeviceName] = useState("");
  const targets = useMemo(
    () => connectedDevices(devices, deviceStatuses),
    [devices, deviceStatuses],
  );
  const activeTarget = useMemo(
    () => targets.find((device) => device.name === targetDeviceName) || targets[0],
    [targetDeviceName, targets],
  );
  const canSend = wsConnected && Boolean(activeTarget);

  useEffect(() => {
    if (!targets.length) {
      setTargetDeviceName("");
      return;
    }

    if (!targets.some((device) => device.name === targetDeviceName)) {
      setTargetDeviceName(targets[0].name);
    }
  }, [targetDeviceName, targets]);

  function submit() {
    const targetName = activeTarget?.name || "";
    const sent = sendScpiCommand(commandValue, targetName, { tag: MONITOR_TAG.USER });

    if (sent) {
      onCommandSent();
      setCommandValue("");
    }
  }

  return {
    canSend,
    changeValue: setCommandValue,
    isConnected: wsConnected,
    selectTarget: setTargetDeviceName,
    submit,
    targetName: activeTarget?.name || "",
    targets,
    value: commandValue,
  };
}
