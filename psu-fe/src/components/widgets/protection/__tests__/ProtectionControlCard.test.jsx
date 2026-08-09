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
  ProtectionControlActions,
  ProtectionControlCard,
} from "../components/ProtectionControlCard.jsx";
import { WIDGET_CONFIG_STORAGE_KEY } from "../../widgetConfigStore.js";

const mockConnection = vi.hoisted(() => ({
  wsConnected: true,
  devices: [{ id: "0", name: "PSU1", type: "TCP" }],
  deviceStatuses: { 0: { state: "CONNECTED" } },
  sendScpiCommand: vi.fn(() => Promise.resolve({ ok: true, response: "0" })),
}));

vi.mock("../../../../connection/ws-proxy/WebSocketConnectionContext.jsx", () => ({
  useWebSocketConnection: () => mockConnection,
}));

describe("ProtectionControlCard", () => {
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
    mockConnection.sendScpiCommand.mockResolvedValue({ ok: true, response: "0" });
  });

  it("renders unconfigured state", () => {
    render(<ProtectionControlCard placement={{ id: "protection-main" }} />);

    expect(
      screen.getByText("Configure protection value, trip, and optional enable commands."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Configure" })).toBeInTheDocument();
  });

  it("saves settings under the placement id", () => {
    render(<ProtectionControlActions placement={{ id: "protection-main" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Configure protection control card" }));
    fireEvent.change(screen.getByLabelText("Device"), { target: { value: "PSU1" } });
    fireEvent.change(screen.getByLabelText("Card name"), { target: { value: "OVP CH1" } });
    fireEvent.change(screen.getByLabelText("Protection key"), { target: { value: "OVP" } });
    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: "CH1" } });
    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "V" } });
    fireEvent.change(screen.getByLabelText("Trip poll (Hz)"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Value color"), { target: { value: "#dc2626" } });
    fireEvent.change(screen.getByLabelText("Value query"), { target: { value: "OVP? CH1" } });
    fireEvent.change(screen.getByLabelText("Value set template"), { target: { value: "OVP CH1,{value}" } });
    fireEvent.change(screen.getByLabelText("Trip query"), {
      target: { value: "OVP:PROTect:STATe? CH1" },
    });
    fireEvent.change(screen.getByLabelText("Min value"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Max value"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Decimals"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(JSON.parse(window.localStorage.getItem(WIDGET_CONFIG_STORAGE_KEY))).toMatchObject({
      "protection-main": {
        type: "protectionControl",
        deviceName: "PSU1",
        cardName: "OVP CH1",
        valueColor: "#dc2626",
        unit: "V",
        channel: "CH1",
        protectionKey: "OVP",
        frequencyHz: 2,
        valueQuery: "OVP? CH1",
        valueSetTemplate: "OVP CH1,{value}",
        tripQuery: "OVP:PROTect:STATe? CH1",
        minValue: 0,
        maxValue: 30,
        decimals: 4,
      },
    });
  });

  it("checks OVP status on mount without rendering enable controls", async () => {
    saveConfig("protection-main", {
      cardName: "OVP CH1",
      unit: "V",
      protectionKey: "OVP",
      valueQuery: "OVP? CH1",
      valueSetTemplate: "OVP CH1,{value}",
      tripQuery: "OVP:PROTect:STATe? CH1",
      maxValue: 30,
    });
    mockConnection.sendScpiCommand
      .mockResolvedValueOnce({ ok: true, response: "25.0000" })
      .mockResolvedValueOnce({ ok: true, response: "0" });

    render(<ProtectionControlCard placement={{ id: "protection-main" }} />);

    expect(await screen.findByText("25.0000")).toBeInTheDocument();
    expect(screen.getByTestId("protection-value-protection-main")).toHaveStyle({ color: "#0f766e" });
    expect(screen.queryByRole("button", { name: "Enable" })).not.toBeInTheDocument();
    expect(screen.getByText("Always on")).toBeInTheDocument();
  });

  it("supports configurable enable state and threshold updates", async () => {
    saveConfig("protection-main", {
      cardName: "OCP CH1",
      unit: "A",
      protectionKey: "OCP",
      valueQuery: "OCP? CH1",
      valueSetTemplate: "OCP CH1,{value}",
      tripQuery: "OCP:PROTect:STATe? CH1",
      enableQuery: "OCP:STATe? CH1",
      enableOnCommand: "OCP:STATe CH1,1",
      enableOffCommand: "OCP:STATe CH1,0",
      maxValue: 10,
    });
    mockConnection.sendScpiCommand
      .mockResolvedValueOnce({ ok: true, response: "2.5000" })
      .mockResolvedValueOnce({ ok: true, response: "0" })
      .mockResolvedValueOnce({ ok: true, response: "1" })
      .mockResolvedValueOnce({ ok: true, response: "OK SENT" })
      .mockResolvedValueOnce({ ok: true, response: "3.1000" })
      .mockResolvedValueOnce({ ok: true, response: "0" })
      .mockResolvedValueOnce({ ok: true, response: "1" })
      .mockResolvedValueOnce({ ok: true, response: "OK SENT" })
      .mockResolvedValueOnce({ ok: true, response: "3.1000" })
      .mockResolvedValueOnce({ ok: true, response: "0" })
      .mockResolvedValueOnce({ ok: true, response: "0" });

    render(<ProtectionControlCard placement={{ id: "protection-main" }} />);

    expect(await screen.findByText("2.5000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disable protection" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Protection threshold"), { target: { value: "3.1" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply threshold" }));

    await waitFor(() => expect(screen.getByText("3.1000")).toBeInTheDocument());
    expect(mockConnection.sendScpiCommand).toHaveBeenCalledWith("OCP CH1,3.1000", "PSU1", {
      tag: "GUI",
      waitForResponse: true,
    });

    fireEvent.click(screen.getByRole("button", { name: "Disable protection" }));

    await waitFor(() => expect(screen.getByText("Disabled")).toBeInTheDocument());
    expect(mockConnection.sendScpiCommand).toHaveBeenCalledWith("OCP:STATe CH1,0", "PSU1", {
      tag: "GUI",
      waitForResponse: true,
    });
  });

  it("blocks invalid threshold input before sending a command", async () => {
    saveConfig("protection-main", {
      cardName: "OVP CH1",
      unit: "V",
      protectionKey: "OVP",
      valueQuery: "OVP? CH1",
      valueSetTemplate: "OVP CH1,{value}",
      tripQuery: "OVP:PROTect:STATe? CH1",
      maxValue: 30,
      decimals: 4,
    });
    mockConnection.sendScpiCommand
      .mockResolvedValueOnce({ ok: true, response: "25.0000" })
      .mockResolvedValueOnce({ ok: true, response: "0" });

    render(<ProtectionControlCard placement={{ id: "protection-main" }} />);

    expect(await screen.findByText("25.0000")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Protection threshold"), { target: { value: "29.12345" } });

    expect(screen.getByText("Value must use at most 4 decimal places.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply threshold" })).toBeDisabled();
  });

  it("emits one trip event when polling detects a newly latched protection", async () => {
    saveConfig("protection-main", {
      cardName: "OVP CH1",
      unit: "V",
      protectionKey: "OVP",
      valueQuery: "OVP? CH1",
      valueSetTemplate: "OVP CH1,{value}",
      tripQuery: "OVP:PROTect:STATe? CH1",
      maxValue: 30,
      frequencyHz: 50,
    });
    const listener = vi.fn();
    window.addEventListener("psu-ext-protection-trip", listener);
    mockConnection.sendScpiCommand
      .mockResolvedValueOnce({ ok: true, response: "25.0000" })
      .mockResolvedValueOnce({ ok: true, response: "0" })
      .mockResolvedValueOnce({ ok: true, response: "1" })
      .mockResolvedValueOnce({ ok: true, response: "1" });

    render(<ProtectionControlCard placement={{ id: "protection-main" }} />);

    await waitFor(() => expect(listener).toHaveBeenCalledTimes(1), { timeout: 1000 });
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          widgetId: "protection-main",
          deviceName: "PSU1",
          channel: "CH1",
          protectionKey: "OVP",
          tripped: true,
          thresholdValue: "25.0000",
          enabled: true,
          source: "poll",
        }),
      }),
    );

    await delay(60);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("psu-ext-protection-trip", listener);
  }, 10000);

  it("keeps input focus during scheduled trip polling", async () => {
    saveConfig("protection-main", {
      cardName: "OVP CH1",
      unit: "V",
      protectionKey: "OVP",
      valueQuery: "OVP? CH1",
      valueSetTemplate: "OVP CH1,{value}",
      tripQuery: "OVP:PROTect:STATe? CH1",
      maxValue: 30,
      frequencyHz: 50,
    });
    mockConnection.sendScpiCommand
      .mockResolvedValueOnce({ ok: true, response: "25.0000" })
      .mockResolvedValueOnce({ ok: true, response: "0" })
      .mockResolvedValue({ ok: true, response: "0" });

    render(<ProtectionControlCard placement={{ id: "protection-main" }} />);

    expect(await screen.findByText("25.0000")).toBeInTheDocument();
    const input = screen.getByLabelText("Protection threshold");
    input.focus();
    expect(document.activeElement).toBe(input);

    await delay(60);
    expect(document.activeElement).toBe(input);
  });
});

function saveConfig(widgetId, config) {
  window.localStorage.setItem(
    WIDGET_CONFIG_STORAGE_KEY,
    JSON.stringify({
      [widgetId]: {
        type: "protectionControl",
        deviceName: "PSU1",
        cardName: "Protection Control",
        valueColor: "#0f766e",
        unit: "",
        channel: "CH1",
        protectionKey: "OVP",
        frequencyHz: 1,
        valueQuery: "OVP? CH1",
        valueSetTemplate: "OVP CH1,{value}",
        tripQuery: "OVP:PROTect:STATe? CH1",
        enableQuery: "",
        enableOnCommand: "",
        enableOffCommand: "",
        enabledResponse: "1",
        disabledResponse: "0",
        minValue: 0,
        maxValue: 9999.9999,
        decimals: 4,
        ...config,
      },
    }),
  );
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
