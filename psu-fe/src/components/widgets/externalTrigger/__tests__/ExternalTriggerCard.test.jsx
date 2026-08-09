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
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ExternalTriggerControlActions,
  ExternalTriggerControlCard,
} from "../components/ExternalTriggerCard.jsx";
import { WIDGET_CONFIG_STORAGE_KEY } from "../../widgetConfigStore.js";

const mockConnection = vi.hoisted(() => ({
  wsConnected: true,
  devices: [{ id: "0", name: "PSU1", type: "TCP" }],
  deviceStatuses: { 0: { state: "CONNECTED" } },
  sendScpiCommand: vi.fn(() => Promise.resolve({ ok: true, response: "NONE" })),
}));

vi.mock("../../../../connection/ws-proxy/WebSocketConnectionContext.jsx", () => ({
  useWebSocketConnection: () => mockConnection,
}));

describe("ExternalTriggerControlCard", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
    mockConnection.wsConnected = true;
    mockConnection.devices = [{ id: "0", name: "PSU1", type: "TCP" }];
    mockConnection.deviceStatuses = { 0: { state: "CONNECTED" } };
    mockConnection.sendScpiCommand.mockReset();
    mockConnection.sendScpiCommand.mockResolvedValue({ ok: true, response: "NONE" });
  });

  it("renders unconfigured state", () => {
    render(<ExternalTriggerControlCard placement={{ id: "trigger-main" }} />);

    expect(
      screen.getByText("Configure trigger queries, setup command, and action options."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Configure" })).toBeInTheDocument();
  });

  it("saves settings and supports action CRUD with default loading", async () => {
    render(<ExternalTriggerControlActions placement={{ id: "trigger-main" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Configure external trigger card" }));
    fireEvent.click(screen.getByRole("button", { name: "Load default config" }));
    fireEvent.change(screen.getByLabelText("Device"), { target: { value: "PSU1" } });
    fireEvent.change(screen.getByLabelText("Card name"), { target: { value: "Bench Triggers" } });
    fireEvent.click(screen.getByRole("button", { name: "Add action" }));
    fireEvent.change(screen.getByLabelText("Action name 7"), { target: { value: "Latch On" } });
    fireEvent.change(screen.getByLabelText("SCPI command 7"), { target: { value: "OUT_ON,CH1" } });

    expect(screen.getByText("Trigger action SCPI commands must be unique.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("SCPI command 7"), { target: { value: "TIM_TOGGLE,CH1" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete action 7" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(JSON.parse(window.localStorage.getItem(WIDGET_CONFIG_STORAGE_KEY))).toMatchObject({
      "trigger-main": {
        type: "externalTriggerControl",
        deviceName: "PSU1",
        cardName: "Bench Triggers",
        statusQueryTemplate: "TRIG:CONF? {trigger},{state}",
        setupCommandTemplate: "TRIG:CONF {trigger},{state},{command}",
        clearTriggerValue: "NONE",
      },
    });
  });

  it("renders all trigger slots and maps known actions", async () => {
    saveConfig("trigger-main");
    mockConnection.sendScpiCommand
      .mockResolvedValueOnce({ ok: true, response: "OUT_ON,CH1" })
      .mockResolvedValueOnce({ ok: true, response: "NONE" })
      .mockResolvedValueOnce({ ok: true, response: "OUT_OFF,CH1" })
      .mockResolvedValueOnce({ ok: true, response: "OUT_TOGGLE,CH1" });

    render(<ExternalTriggerControlCard placement={{ id: "trigger-main" }} />);

    await waitFor(() => expect(screen.getByLabelText("T1 LOW action")).toHaveValue("OUT_ON,CH1"));
    expect(screen.getByLabelText("T1 HIGH action")).toHaveValue("NONE");
    expect(screen.getByLabelText("T2 LOW action")).toHaveValue("OUT_OFF,CH1");
    expect(screen.getByLabelText("T2 HIGH action")).toHaveValue("OUT_TOGGLE,CH1");
    expect(screen.getByText("PSU1")).toBeInTheDocument();
  });

  it("shows an unmapped payload safely", async () => {
    saveConfig("trigger-main");
    mockConnection.sendScpiCommand
      .mockResolvedValueOnce({ ok: true, response: "OUT_ON,CH1" })
      .mockResolvedValueOnce({ ok: true, response: "CUSTOM,CH1" })
      .mockResolvedValueOnce({ ok: true, response: "OUT_OFF,CH1" })
      .mockResolvedValueOnce({ ok: true, response: "NONE" });

    render(<ExternalTriggerControlCard placement={{ id: "trigger-main" }} />);

    await waitFor(() => expect(screen.getByLabelText("T1 HIGH action")).toHaveValue("CUSTOM,CH1"));
    expect(screen.getByText("CUSTOM,CH1")).toBeInTheDocument();
  });

  it("stages slot updates until save and then refreshes all trigger states", async () => {
    saveConfig("trigger-main");
    mockConnection.sendScpiCommand
      .mockResolvedValueOnce({ ok: true, response: "OUT_ON,CH1" })
      .mockResolvedValueOnce({ ok: true, response: "NONE" })
      .mockResolvedValueOnce({ ok: true, response: "OUT_OFF,CH1" })
      .mockResolvedValueOnce({ ok: true, response: "NONE" })
      .mockResolvedValueOnce({ ok: true, response: "OK" })
      .mockResolvedValueOnce({ ok: true, response: "OUT_ON,CH1" })
      .mockResolvedValueOnce({ ok: true, response: "TIM_START,CH1" })
      .mockResolvedValueOnce({ ok: true, response: "OUT_OFF,CH1" })
      .mockResolvedValueOnce({ ok: true, response: "NONE" });

    render(<ExternalTriggerControlCard placement={{ id: "trigger-main" }} />);

    await waitFor(() => expect(screen.getByLabelText("T1 LOW action")).toHaveValue("OUT_ON,CH1"));
    expect(screen.getByRole("button", { name: "Save trigger configuration" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("T1 HIGH action"), {
      target: { value: "TIM_START,CH1" },
    });

    expect(screen.getByLabelText("T1 HIGH action")).toHaveValue("TIM_START,CH1");
    expect(mockConnection.sendScpiCommand).not.toHaveBeenCalledWith("TRIG:CONF 1,HIGH,TIM_START,CH1", "PSU1", {
      tag: "GUI",
      waitForResponse: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Save trigger configuration" }));

    await waitFor(() => expect(screen.getByLabelText("T1 HIGH action")).toHaveValue("TIM_START,CH1"));
    expect(mockConnection.sendScpiCommand).toHaveBeenCalledWith("TRIG:CONF 1,HIGH,TIM_START,CH1", "PSU1", {
      tag: "GUI",
      waitForResponse: true,
    });
  });
});

function saveConfig(widgetId) {
  window.localStorage.setItem(
    WIDGET_CONFIG_STORAGE_KEY,
    JSON.stringify({
      [widgetId]: {
        type: "externalTriggerControl",
        deviceName: "PSU1",
        cardName: "External Triggers",
        statusQueryTemplate: "TRIG:CONF? {trigger},{state}",
        setupCommandTemplate: "TRIG:CONF {trigger},{state},{command}",
        clearTriggerValue: "NONE",
        actionOptions: [
          { id: "out-on", name: "Output On", scpiCommand: "OUT_ON,CH1" },
          { id: "out-off", name: "Output Off", scpiCommand: "OUT_OFF,CH1" },
          { id: "out-toggle", name: "Output Toggle", scpiCommand: "OUT_TOGGLE,CH1" },
          { id: "tim-start", name: "Timer Start", scpiCommand: "TIM_START,CH1" },
        ],
      },
    }),
  );
}
