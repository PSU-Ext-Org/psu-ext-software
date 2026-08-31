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
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimerQueueCard } from "../components/TimerQueueCard.jsx";
import { WIDGET_CONFIG_STORAGE_KEY } from "../../widgetConfigStore.js";

const mockConnection = vi.hoisted(() => ({
  wsConnected: true,
  devices: [{ id: "0", name: "PSU1", type: "TCP" }],
  deviceStatuses: { 0: { state: "CONNECTED" } },
  sendScpiCommand: vi.fn(() => Promise.resolve({ ok: true, response: "NONE,IDLE,0.000" })),
}));

vi.mock("../../../../connection/ws-proxy/WebSocketConnectionContext.jsx", () => ({
  useWebSocketConnection: () => mockConnection,
}));

describe("TimerQueueCard", () => {
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
    mockConnection.sendScpiCommand.mockResolvedValue({ ok: true, response: "NONE,IDLE,0.000" });
  });

  it("shows setup prompt when no device is configured", () => {
    render(<TimerQueueCard placement={{ id: "timer-main" }} />);

    expect(screen.getByText("Configure a target device for this timer queue widget.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Configure" })).toBeInTheDocument();
  });

  it("shows the shared validation message in timer settings when device is missing", () => {
    render(<TimerQueueCard placement={{ id: "timer-main" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Configure" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Select a target device.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("allows selecting a device before any timers are configured", () => {
    render(<TimerQueueCard placement={{ id: "timer-main" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Configure" }));
    fireEvent.change(screen.getByLabelText("Device"), { target: { value: "PSU1" } });

    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(WIDGET_CONFIG_STORAGE_KEY))["timer-main"]).toMatchObject({
      deviceName: "PSU1",
      timers: [],
    });
  });

  it("preserves draft timers when selecting the device for the first time", () => {
    render(<TimerQueueCard placement={{ id: "timer-main" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Add timer" }));
    fireEvent.change(screen.getByLabelText("Timer id 1"), { target: { value: "A01" } });
    fireEvent.change(screen.getByLabelText("Timer duration 1"), { target: { value: "5.000" } });
    fireEvent.click(screen.getByRole("button", { name: "Configure" }));
    fireEvent.change(screen.getByLabelText("Device"), { target: { value: "PSU1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(JSON.parse(window.localStorage.getItem(WIDGET_CONFIG_STORAGE_KEY))["timer-main"].timers).toEqual([
      { id: "A01", durationSeconds: "5.000", relayOnAfterExpiry: false },
    ]);
  });

  it("loads status once on mount and refreshes only on button click", async () => {
    saveConfig("timer-main");
    mockConnection.sendScpiCommand.mockResolvedValue({ ok: true, response: "A01,RUNNING,5.000" });

    render(<TimerQueueCard placement={{ id: "timer-main" }} />);

    await waitFor(() => expect(mockConnection.sendScpiCommand).toHaveBeenCalledTimes(1));
    expect(mockConnection.sendScpiCommand).toHaveBeenCalledWith("TIM:STATUS? CH1", "PSU1", {
      tag: "GUI",
      waitForResponse: true,
    });

    fireEvent.click(screen.getByRole("button", { name: "Refresh timer status" }));

    await waitFor(() => expect(mockConnection.sendScpiCommand).toHaveBeenCalledTimes(2));
  });

  it("starts from idle by clearing, uploading, and starting the preset", async () => {
    saveConfig("timer-main");
    mockConnection.sendScpiCommand
      .mockResolvedValueOnce({ ok: true, response: "NONE,IDLE,0.000" })
      .mockResolvedValueOnce({ ok: true, response: "OK" })
      .mockResolvedValueOnce({ ok: true, response: "OK" })
      .mockResolvedValueOnce({ ok: true, response: "OK" })
      .mockResolvedValueOnce({ ok: true, response: "OK" });

    render(<TimerQueueCard placement={{ id: "timer-main" }} />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Load and start" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Load and start" }));

    await waitFor(() => expect(mockConnection.sendScpiCommand).toHaveBeenCalledTimes(5));
    expect(mockConnection.sendScpiCommand).toHaveBeenNthCalledWith(2, "TIM:CLE CH1", "PSU1", {
      tag: "GUI",
      waitForResponse: true,
    });
    expect(mockConnection.sendScpiCommand).toHaveBeenNthCalledWith(3, "TIM:ADD CH1,A01,5.000,1", "PSU1", {
      tag: "GUI",
      waitForResponse: true,
    });
    expect(mockConnection.sendScpiCommand).toHaveBeenNthCalledWith(4, "TIM:ADD CH1,A02,2.500,0", "PSU1", {
      tag: "GUI",
      waitForResponse: true,
    });
    expect(mockConnection.sendScpiCommand).toHaveBeenNthCalledWith(5, "TIM:START CH1", "PSU1", {
      tag: "GUI",
      waitForResponse: true,
    });
  });

  it("pauses a running timer with only the pause command", async () => {
    saveConfig("timer-main");
    mockConnection.sendScpiCommand
      .mockResolvedValueOnce({ ok: true, response: "A01,RUNNING,5.000" })
      .mockResolvedValueOnce({ ok: true, response: "OK" });

    render(<TimerQueueCard placement={{ id: "timer-main" }} />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    await waitFor(() => expect(mockConnection.sendScpiCommand).toHaveBeenCalledTimes(2));
    expect(mockConnection.sendScpiCommand).toHaveBeenLastCalledWith("TIM:PAUSE CH1", "PSU1", {
      tag: "GUI",
      waitForResponse: true,
    });
  });

  it("resumes from paused states with only the start command", async () => {
    saveConfig("timer-main");
    mockConnection.sendScpiCommand
      .mockResolvedValueOnce({ ok: true, response: "A01,PAUSED,5.000" })
      .mockResolvedValueOnce({ ok: true, response: "OK" });

    render(<TimerQueueCard placement={{ id: "timer-main" }} />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));

    await waitFor(() => expect(mockConnection.sendScpiCommand).toHaveBeenCalledTimes(2));
    expect(mockConnection.sendScpiCommand).toHaveBeenLastCalledWith("TIM:START CH1", "PSU1", {
      tag: "GUI",
      waitForResponse: true,
    });
  });

  it("decreases local progress over browser time while running", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-29T12:00:00.000Z"));
    saveConfig("timer-main");
    mockConnection.sendScpiCommand.mockResolvedValueOnce({ ok: true, response: "A01,RUNNING,5.000" });

    render(<TimerQueueCard placement={{ id: "timer-main" }} />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(/00:0[45]\.\d{3}/)).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(1200);
    expect(screen.getByText("00:03.800")).toBeInTheDocument();
  });

  it("freezes progress for paused and protection-paused states", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-29T12:00:00.000Z"));
    saveConfig("timer-main");
    mockConnection.sendScpiCommand.mockResolvedValueOnce({ ok: true, response: "A01,OVP,5.000" });

    render(<TimerQueueCard placement={{ id: "timer-main" }} />);

    await vi.runOnlyPendingTimersAsync();
    expect(screen.getByText("00:05.000")).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(1200);
    expect(screen.getByText("00:05.000")).toBeInTheDocument();
  });

  it("shows out-of-sync warning when device active id is not in local config", async () => {
    saveConfig("timer-main");
    mockConnection.sendScpiCommand.mockResolvedValueOnce({ ok: true, response: "ZZZ,RUNNING,5.000" });

    render(<TimerQueueCard placement={{ id: "timer-main" }} />);

    await waitFor(() => expect(screen.getAllByText("Out of sync").length).toBeGreaterThan(0));
    expect(screen.getByText("Progress unavailable")).toBeInTheDocument();
  });

  it("shows local preset as not loaded when device queue is empty", async () => {
    saveConfig("timer-main");
    mockConnection.sendScpiCommand.mockResolvedValueOnce({ ok: true, response: "NONE,IDLE,0.000" });

    render(<TimerQueueCard placement={{ id: "timer-main" }} />);

    await waitFor(() => expect(screen.getAllByText("Preset not loaded").length).toBeGreaterThan(0));
  });

  it("shows timer validation only once while editing", async () => {
    saveConfig("timer-main");
    mockConnection.sendScpiCommand.mockResolvedValueOnce({ ok: true, response: "NONE,IDLE,0.000" });

    render(<TimerQueueCard placement={{ id: "timer-main" }} />);

    await waitFor(() => expect(screen.getAllByText("Preset not loaded").length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText("Timer id 1"), { target: { value: "A0" } });

    expect(screen.getAllByText("Timer ids must be exactly 3 characters.")).toHaveLength(1);
  });

  it("keeps portaled duration validation sized to its message", async () => {
    saveConfig("timer-main");
    mockConnection.sendScpiCommand.mockResolvedValueOnce({ ok: true, response: "NONE,IDLE,0.000" });

    render(<TimerQueueCard placement={{ id: "timer-main" }} />);

    await waitFor(() => expect(screen.getAllByText("Preset not loaded").length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText("Timer duration 1"), { target: { value: "x5.000" } });

    const validation = screen.getByText("Timer durations must be positive seconds with up to 3 decimals.");
    expect(validation).not.toHaveClass("left-0");
    expect(validation).not.toHaveClass("right-0");
    expect(validation).toHaveStyle({ transform: "translate(-100%, -100%)" });
  });
});

function saveConfig(widgetId) {
  window.localStorage.setItem(
    WIDGET_CONFIG_STORAGE_KEY,
    JSON.stringify({
      [widgetId]: {
        type: "timerQueueControl",
        deviceName: "PSU1",
        channel: "CH1",
        cardName: "Timer Queue",
        timers: [
          { id: "A01", durationSeconds: "5.000", relayOnAfterExpiry: true },
          { id: "A02", durationSeconds: "2.500", relayOnAfterExpiry: false },
        ],
      },
    }),
  );
}
