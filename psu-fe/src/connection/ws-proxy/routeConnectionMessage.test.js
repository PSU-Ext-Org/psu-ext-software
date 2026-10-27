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
import { describe, expect, it, vi } from "vitest";
import { routeConnectionMessage } from "./routeConnectionMessage.js";

function createHandlers() {
  return {
    commands: { resolvePendingScpiCommand: vi.fn(() => false) },
    scheduler: {
      handleScpiSchedulerMessage: vi.fn(() => false),
      handleScpiSchedulerBinaryMessage: vi.fn(() => false),
    },
    management: { updateDeviceManagementFromMessage: vi.fn(() => false) },
    identity: { updateDeviceIdentityFromMessage: vi.fn() },
    devices: { updateDeviceStateFromMessage: vi.fn() },
  };
}

const message = { type: "RES", uuid: "request-1", payload: "OK CONNECTED" };

describe("connection response routing", () => {
  it.each(["RES", "BIN"])("gives awaited commands priority for %s", (type) => {
    const handlers = createHandlers();
    handlers.commands.resolvePendingScpiCommand.mockReturnValue(true);
    routeConnectionMessage({ ...message, type }, handlers);
    expect(handlers.scheduler.handleScpiSchedulerMessage).not.toHaveBeenCalled();
    expect(handlers.scheduler.handleScpiSchedulerBinaryMessage).not.toHaveBeenCalled();
    expect(handlers.devices.updateDeviceStateFromMessage).not.toHaveBeenCalled();
  });

  it.each([
    ["RES", "handleScpiSchedulerMessage"],
    ["BIN", "handleScpiSchedulerBinaryMessage"],
  ])("dispatches %s only to its scheduler decoder", (type, decoder) => {
    const handlers = createHandlers();
    handlers.scheduler[decoder].mockReturnValue(true);
    routeConnectionMessage({ ...message, type }, handlers);
    expect(handlers.scheduler[decoder]).toHaveBeenCalledWith({ ...message, type });
    expect(handlers.management.updateDeviceManagementFromMessage).not.toHaveBeenCalled();
    expect(handlers.devices.updateDeviceStateFromMessage).not.toHaveBeenCalled();
  });

  it("does not interpret consumed management replies as device lifecycle", () => {
    const handlers = createHandlers();
    handlers.management.updateDeviceManagementFromMessage.mockReturnValue(true);
    routeConnectionMessage(message, handlers);
    expect(handlers.identity.updateDeviceIdentityFromMessage).not.toHaveBeenCalled();
    expect(handlers.devices.updateDeviceStateFromMessage).not.toHaveBeenCalled();
  });

  it("passes unconsumed responses to legacy identity and UUID-aware lifecycle", () => {
    const handlers = createHandlers();
    routeConnectionMessage(message, handlers);
    expect(handlers.identity.updateDeviceIdentityFromMessage).toHaveBeenCalledWith(message.payload);
    expect(handlers.devices.updateDeviceStateFromMessage).toHaveBeenCalledWith(message.payload, message.uuid);
    expect(handlers.identity.updateDeviceIdentityFromMessage.mock.invocationCallOrder[0])
      .toBeLessThan(handlers.devices.updateDeviceStateFromMessage.mock.invocationCallOrder[0]);
  });
});
