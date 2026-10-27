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
/**
 * Routes an envelope to its request owner, preserving command/scheduler priority.
 * A consumed reply must not be interpreted again as device lifecycle traffic.
 * @param {{type: string, uuid: string, payload: string}} message
 * @param {object} handlers - Focused response consumers in protocol priority order.
 */
export function routeConnectionMessage(message, handlers) {
  if (handlers.commands.resolvePendingScpiCommand(message)) return;
  if (message.type === "RES" && handlers.scheduler.handleScpiSchedulerMessage(message)) return;
  if (message.type === "BIN" && handlers.scheduler.handleScpiSchedulerBinaryMessage(message)) return;
  if (handlers.management.updateDeviceManagementFromMessage(message.payload, message.uuid)) return;
  handlers.identity.updateDeviceIdentityFromMessage(message.payload);
  handlers.devices.updateDeviceStateFromMessage(message.payload, message.uuid);
}
