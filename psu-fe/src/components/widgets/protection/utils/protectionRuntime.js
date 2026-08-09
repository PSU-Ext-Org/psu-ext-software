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
import { MONITOR_TAG } from "../../../../connection/ws-proxy/monitor/monitorTagQueue.js";
import {
  hasEnableSupport,
  parseEnabledState,
  parseTripState,
} from "./protectionHelpers.js";

export async function readFullRuntimeSnapshot(config, sendScpiCommand) {
  const thresholdResponse = await sendProtectionCommand(
    sendScpiCommand,
    config.deviceName,
    config.valueQuery,
    MONITOR_TAG.SCHEDULER,
  );
  const tripResponse = await sendProtectionCommand(
    sendScpiCommand,
    config.deviceName,
    config.tripQuery,
    MONITOR_TAG.SCHEDULER,
  );
  const enabledState = hasEnableSupport(config)
    ? parseEnabledState(
      (await sendProtectionCommand(
        sendScpiCommand,
        config.deviceName,
        config.enableQuery,
        MONITOR_TAG.SCHEDULER,
      )).response,
      config,
    )
    : "unsupported";

  return {
    thresholdValue: String(thresholdResponse.response).trim(),
    enabledState,
    tripped: parseTripState(tripResponse.response),
  };
}

export async function readTripStateSnapshot(config, sendScpiCommand) {
  const tripResponse = await sendProtectionCommand(
    sendScpiCommand,
    config.deviceName,
    config.tripQuery,
    MONITOR_TAG.SCHEDULER,
  );

  return {
    tripped: parseTripState(tripResponse.response),
  };
}

export function sendProtectionCommand(sendScpiCommand, deviceName, command, tag = MONITOR_TAG.GUI) {
  return sendScpiCommand(command, deviceName, {
    tag,
    waitForResponse: true,
  });
}

export function emitTripEventIfNeeded({ config, nextRuntime, previousTripped, source, widgetId }) {
  if (nextRuntime.tripped !== true || previousTripped === true) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("psu-ext-protection-trip", {
      detail: {
        widgetId,
        deviceName: config.deviceName,
        channel: config.channel,
        protectionKey: config.protectionKey,
        tripped: true,
        thresholdValue: nextRuntime.thresholdValue,
        enabled: nextRuntime.enabledState !== "disabled",
        source,
      },
    }),
  );
}

export function missingSendScpiCommand() {
  return Promise.reject(new Error("SCPI command sender is unavailable."));
}
