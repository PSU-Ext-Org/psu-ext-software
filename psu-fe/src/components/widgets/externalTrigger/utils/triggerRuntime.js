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
  normalizeTriggerScpiPayload,
  TRIGGER_SLOT_DEFINITIONS,
} from "./triggerHelpers.js";

export async function readTriggerSlotsSnapshot(config, sendScpiCommand) {
  const responses = await Promise.all(
    TRIGGER_SLOT_DEFINITIONS.map(async (slot) => ({
      key: slot.key,
      response: await sendExternalTriggerCommand(
        sendScpiCommand,
        config.deviceName,
        interpolateStatusQuery(config.statusQueryTemplate, slot),
        MONITOR_TAG.SCHEDULER,
      ),
    })),
  );

  return responses.reduce(
    (slots, entry) => ({
      ...slots,
      [entry.key]: normalizeTriggerScpiPayload(entry.response.response),
    }),
    {},
  );
}

export function interpolateStatusQuery(template, slot) {
  return template
    .replaceAll("{trigger}", slot.trigger)
    .replaceAll("{state}", slot.state);
}

export function interpolateSetupCommand(template, slot, command) {
  return template
    .replaceAll("{trigger}", slot.trigger)
    .replaceAll("{state}", slot.state)
    .replaceAll("{command}", command);
}

export function sendExternalTriggerCommand(sendScpiCommand, deviceName, command, tag = MONITOR_TAG.GUI) {
  return sendScpiCommand(command, deviceName, {
    tag,
    waitForResponse: true,
  });
}

export function missingSendScpiCommand() {
  return Promise.reject(new Error("SCPI command sender is unavailable."));
}
