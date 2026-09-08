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
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocketMonitor, WebSocketMonitorCard } from "../monitor/WebSocketMonitor.jsx";

const mockConnection = vi.hoisted(() => ({
  wsConnected: false,
  devices: [],
  deviceStatuses: {},
  wsMessages: "",
  getWsMessages: vi.fn(() => ""),
  subscribeWsMessages: vi.fn(() => vi.fn()),
  sendScpiCommand: vi.fn(),
  clearWsMessages: vi.fn(),
}));

vi.mock("../../../connection/ws-proxy/WebSocketConnectionContext.jsx", () => ({
  useWebSocketConnection: () => mockConnection,
}));

const MONITOR_TEXT = [
  "[2026-05-10 07:30:05.042] [SYSTEM] OUT [54f2f602-98db-4c14-8168-b4ec58e2d8dc] /status",
  "[2026-05-10 07:30:05.043] [USER] OUT [08b0f403-6c3e-4cb4-bf3b-7f33bfa32b5d] MEAS:VOLT?",
  "[2026-05-10 07:30:05.044] [WIDGET] OUT [8ab4e3b8-bd89-4d8e-a58f-50eb1d0dfb4e] OUTP?",
  "[2026-05-10 07:30:05.045] [USER] IN [08b0f403-6c3e-4cb4-bf3b-7f33bfa32b5d] 12.34",
].join("\n");

describe("WebSocketMonitor", () => {
  afterEach(() => {
    cleanup();
    mockConnection.wsConnected = false;
    mockConnection.devices = [];
    mockConnection.deviceStatuses = {};
    mockConnection.wsMessages = "";
    mockConnection.getWsMessages.mockImplementation(() => mockConnection.wsMessages);
    mockConnection.subscribeWsMessages.mockImplementation(() => vi.fn());
    mockConnection.sendScpiCommand.mockReset();
    mockConnection.clearWsMessages.mockReset();
    vi.restoreAllMocks();
  });

  it("derives available tag filters from monitor messages", () => {
    mockConnection.wsMessages = MONITOR_TEXT;
    mockConnection.getWsMessages.mockImplementation(() => mockConnection.wsMessages);

    render(<WebSocketMonitor />);

    expect(screen.getByRole("button", { name: "SYSTEM" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "USER" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "WIDGET" })).toBeInTheDocument();
  });

  it("selects multiple tags and filters visible monitor text without losing full text", () => {
    mockConnection.wsMessages = MONITOR_TEXT;
    mockConnection.getWsMessages.mockImplementation(() => mockConnection.wsMessages);

    render(<WebSocketMonitor />);

    fireEvent.click(screen.getByRole("button", { name: "USER" }));
    expect(screen.getByText(/MEAS:VOLT\?/)).toBeInTheDocument();
    expect(screen.getByText(/12\.34/)).toBeInTheDocument();
    expect(screen.queryByText(/\/status/)).not.toBeInTheDocument();
    expect(screen.queryByText(/OUTP\?/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "WIDGET" }));
    expect(screen.getByText(/MEAS:VOLT\?/)).toBeInTheDocument();
    expect(screen.getByText(/OUTP\?/)).toBeInTheDocument();
    expect(screen.queryByText(/\/status/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByText(/\/status/)).toBeInTheDocument();
    expect(screen.getByText(/MEAS:VOLT\?/)).toBeInTheDocument();
    expect(screen.getByText(/OUTP\?/)).toBeInTheDocument();
  });

  it("removes one selected tag with its chip x button", () => {
    mockConnection.wsMessages = MONITOR_TEXT;
    mockConnection.getWsMessages.mockImplementation(() => mockConnection.wsMessages);

    render(<WebSocketMonitor />);

    fireEvent.click(screen.getByRole("button", { name: "USER" }));
    fireEvent.click(screen.getByRole("button", { name: "WIDGET" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove USER filter" }));

    expect(screen.queryByText(/MEAS:VOLT\?/)).not.toBeInTheDocument();
    expect(screen.queryByText(/12\.34/)).not.toBeInTheDocument();
    expect(screen.getByText(/OUTP\?/)).toBeInTheDocument();
  });

  it("shows compact log controls before tags exist", () => {
    render(<WebSocketMonitor />);

    expect(screen.queryByText("Available:")).not.toBeInTheDocument();
    expect(screen.getByText("Tags:")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
    expect(screen.getByText("Log:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
    expect(screen.getByText("No websocket messages yet.")).toBeInTheDocument();
  });

  it("arms clear on first click and clears the stored monitor log on second click", () => {
    mockConnection.wsMessages = MONITOR_TEXT;
    mockConnection.getWsMessages.mockImplementation(() => mockConnection.wsMessages);

    render(<WebSocketMonitor />);

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(mockConnection.clearWsMessages).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Clear", pressed: true })).toHaveClass("bg-rose-700");

    fireEvent.click(screen.getByRole("button", { name: "Clear", pressed: true }));

    expect(mockConnection.clearWsMessages).toHaveBeenCalledTimes(1);
  });

  it("keeps clear armed when new monitor messages arrive", () => {
    let listener = null;
    mockConnection.wsMessages = MONITOR_TEXT;
    mockConnection.getWsMessages.mockImplementation(() => mockConnection.wsMessages);
    mockConnection.subscribeWsMessages.mockImplementation((nextListener) => {
      listener = nextListener;
      return vi.fn();
    });

    render(<WebSocketMonitor />);

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByRole("button", { name: "Clear", pressed: true })).toHaveClass("bg-rose-700");

    mockConnection.wsMessages =
      `${MONITOR_TEXT}\n[2026-05-10 07:30:05.046] [SYSTEM] IN [21d53c47-0b8b-4adb-a7c5-1ff6bca2d26b] STATUS`;
    listener();

    expect(screen.getByRole("button", { name: "Clear", pressed: true })).toHaveClass("bg-rose-700");
  });

  it("disarms clear when clicking outside the clear button", () => {
    mockConnection.wsMessages = MONITOR_TEXT;
    mockConnection.getWsMessages.mockImplementation(() => mockConnection.wsMessages);

    render(<WebSocketMonitor />);

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByRole("button", { name: "Clear", pressed: true })).toHaveClass("bg-rose-700");

    fireEvent.pointerDown(screen.getByRole("button", { name: "Download" }));

    expect(screen.getByRole("button", { name: "Clear", pressed: false })).not.toHaveClass(
      "bg-rose-700",
    );
    expect(mockConnection.clearWsMessages).not.toHaveBeenCalled();
  });

  it("clears when clicking the armed clear button again", () => {
    mockConnection.wsMessages = MONITOR_TEXT;
    mockConnection.getWsMessages.mockImplementation(() => mockConnection.wsMessages);

    render(<WebSocketMonitor />);

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Clear", pressed: true }));
    fireEvent.click(screen.getByRole("button", { name: "Clear", pressed: true }));

    expect(mockConnection.clearWsMessages).toHaveBeenCalledTimes(1);
  });

  it("downloads the stored monitor log as a text file", () => {
    const originalCreateObjectURL = window.URL.createObjectURL;
    const originalRevokeObjectURL = window.URL.revokeObjectURL;
    const createObjectURL = vi.fn(() => "blob:psu-log");
    const revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const append = vi.spyOn(document.body, "append");
    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    mockConnection.wsMessages = MONITOR_TEXT;
    mockConnection.getWsMessages.mockImplementation(() => mockConnection.wsMessages);

    render(<WebSocketMonitor />);

    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(append).toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:psu-log");

    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      value: originalRevokeObjectURL,
    });
  });

  it("can wrap log text and dock the command row when used in compact widgets", () => {
    render(<WebSocketMonitor dockCommand logClassName="h-48" wrapLog />);

    expect(screen.getByText("No websocket messages yet.")).toHaveClass(
      "h-48",
      "overflow-x-hidden",
      "whitespace-pre-wrap",
      "break-words",
    );
    expect(screen.getByRole("textbox").parentElement).toHaveClass("mt-auto");
  });

  it("does not render the generic card status block", () => {
    mockConnection.wsMessages = MONITOR_TEXT;
    mockConnection.getWsMessages.mockImplementation(() => mockConnection.wsMessages);

    render(<WebSocketMonitorCard />);

    expect(screen.queryByText("Status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  it("wraps log lines by default in card and popup usage without docking the command row", () => {
    render(<WebSocketMonitorCard logClassName="h-[min(60vh,34rem)]" />);

    expect(screen.getByText("No websocket messages yet.")).toHaveClass(
      "h-[min(60vh,34rem)]",
      "overflow-x-hidden",
      "whitespace-pre-wrap",
      "break-words",
    );
    expect(screen.getByRole("textbox").parentElement).not.toHaveClass("mt-auto");
  });

  it("shows connected device names in the command target dropdown", () => {
    mockConnection.wsConnected = true;
    mockConnection.devices = [
      { id: "0", name: "PSU1" },
      { id: "1", name: "PSU2" },
      { id: "2", name: "USB1" },
    ];
    mockConnection.deviceStatuses = {
      0: { state: "CONNECTED" },
      1: { state: "CONNECTED" },
      2: { state: "DISCONNECTED" },
    };

    render(<WebSocketMonitor />);

    expect(screen.getByRole("combobox", { name: "Command target device" })).toHaveValue("PSU1");
    expect(screen.getByRole("option", { name: "PSU1" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "PSU2" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "USB1" })).not.toBeInTheDocument();
  });

  it("sends commands to the selected target device", () => {
    mockConnection.wsConnected = true;
    mockConnection.devices = [
      { id: "0", name: "PSU1" },
      { id: "1", name: "PSU2" },
    ];
    mockConnection.deviceStatuses = {
      0: { state: "CONNECTED" },
      1: { state: "CONNECTED" },
    };
    mockConnection.sendScpiCommand.mockReturnValue(true);

    render(<WebSocketMonitor />);

    fireEvent.change(screen.getByRole("combobox", { name: "Command target device" }), {
      target: { value: "PSU2" },
    });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "MEAS:VOLT?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(mockConnection.sendScpiCommand).toHaveBeenCalledWith("MEAS:VOLT?", "PSU2", {
      tag: "USER",
    });
  });

  it.each([false, true])("selects only USER after sending and restores all messages when removed (existing filter: %s)", (hasFilter) => {
    mockConnection.wsConnected = true;
    mockConnection.wsMessages = MONITOR_TEXT;
    mockConnection.getWsMessages.mockImplementation(() => mockConnection.wsMessages);
    mockConnection.devices = [{ id: "0", name: "PSU1" }];
    mockConnection.deviceStatuses = { 0: { state: "CONNECTED" } };
    mockConnection.sendScpiCommand.mockReturnValue(true);

    render(<WebSocketMonitor />);

    if (hasFilter) fireEvent.click(screen.getByRole("button", { name: "SYSTEM" }));
    expect(screen.queryByRole("button", { name: "Remove USER filter" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "MEAS:VOLT?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(screen.queryByRole("button", { name: "Remove SYSTEM filter" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove USER filter" })).toBeInTheDocument();
    expect(screen.getByText(/MEAS:VOLT\?/)).toBeInTheDocument();
    expect(screen.getByText(/12\.34/)).toBeInTheDocument();
    expect(screen.queryByText(/\/status/)).not.toBeInTheDocument();
    expect(screen.queryByText(/OUTP\?/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove USER filter" }));
    expect(screen.getByText(/\/status/)).toBeInTheDocument();
    expect(screen.getByText(/OUTP\?/)).toBeInTheDocument();
  });

  it("keeps the automatic USER filter while the log is empty or contains only background messages", () => {
    mockConnection.wsConnected = true;
    mockConnection.devices = [{ id: "0", name: "PSU1" }];
    mockConnection.deviceStatuses = { 0: { state: "CONNECTED" } };
    mockConnection.sendScpiCommand.mockReturnValue(true);
    const { rerender } = render(<WebSocketMonitor />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "MEAS:VOLT?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("button", { name: "Remove USER filter" })).toBeInTheDocument();

    mockConnection.wsMessages = MONITOR_TEXT.split("\n")[0];
    rerender(<WebSocketMonitor />);
    expect(screen.getByRole("button", { name: "Remove USER filter" })).toBeInTheDocument();
    expect(screen.queryByText(/\/status/)).not.toBeInTheDocument();

    mockConnection.wsMessages = "";
    rerender(<WebSocketMonitor />);
    expect(screen.getByRole("button", { name: "Remove USER filter" })).toBeInTheDocument();
  });

  it("shows abbreviated UUIDs in the rendered websocket log", () => {
    mockConnection.wsMessages = MONITOR_TEXT;
    mockConnection.getWsMessages.mockImplementation(() => mockConnection.wsMessages);

    render(<WebSocketMonitor />);

    expect(screen.getByText(/\[54f2f602\] \/status/)).toBeInTheDocument();
    expect(screen.getByText(/\[08b0f403\] 12\.34/)).toBeInTheDocument();
    expect(screen.queryByText(/98db-4c14/)).not.toBeInTheDocument();
  });
});
