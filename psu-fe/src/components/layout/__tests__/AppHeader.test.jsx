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
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "../app/AppHeader.jsx";

const mockConnection = vi.hoisted(() => ({
  wsConnected: false,
  deviceStatuses: {},
  devices: [],
  wsMessages: "",
  getWsMessages: vi.fn(() => ""),
  subscribeWsMessages: vi.fn(() => vi.fn()),
  sendScpiCommand: vi.fn(),
  clearWsMessages: vi.fn(),
}));

vi.mock("../../../connection/ws-proxy/WebSocketConnectionContext.jsx", () => ({
  useWebSocketConnection: () => mockConnection,
}));

function renderHeader() {
  render(
    <MemoryRouter>
      <AppHeader />
    </MemoryRouter>,
  );
}

describe("AppHeader", () => {
  afterEach(() => {
    cleanup();
    mockConnection.wsConnected = false;
    mockConnection.deviceStatuses = {};
    mockConnection.devices = [];
    mockConnection.wsMessages = "";
    mockConnection.getWsMessages.mockImplementation(() => mockConnection.wsMessages);
    mockConnection.subscribeWsMessages.mockImplementation(() => vi.fn());
    mockConnection.sendScpiCommand.mockReset();
    mockConnection.clearWsMessages.mockReset();
  });

  it("shows offline status when websocket is disconnected", () => {
    renderHeader();

    expect(screen.getByLabelText("Connection status: Offline")).toBeInTheDocument();
    expect(screen.getByText("Offline")).toBeInTheDocument();
  });

  it("shows proxy-only status when websocket is connected without a device", () => {
    mockConnection.wsConnected = true;

    renderHeader();

    expect(screen.getByLabelText("Connection status: Proxy only")).toBeInTheDocument();
    expect(screen.getByText("Proxy only")).toBeInTheDocument();
  });

  it("shows connected device count when devices are connected", () => {
    mockConnection.wsConnected = true;
    mockConnection.deviceStatuses = {
      0: { state: "CONNECTED" },
      1: { state: "CONNECTED" },
    };

    renderHeader();

    expect(screen.getByLabelText("Connection status: 2 devices connected")).toBeInTheDocument();
    expect(screen.getByText("2 devices connected")).toBeInTheDocument();
  });

  it("uses singular connected label for one device", () => {
    mockConnection.wsConnected = true;
    mockConnection.deviceStatuses = {
      0: { state: "CONNECTED" },
    };

    renderHeader();

    expect(screen.getByLabelText("Connection status: 1 device connected")).toBeInTheDocument();
    expect(screen.getByText("1 device connected")).toBeInTheDocument();
  });

  it("places the terminal action after config and opens the monitor dialog", () => {
    renderHeader();

    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    const navControlLabels = [...within(nav).getAllByRole("link"), ...within(nav).getAllByRole("button")]
      .sort((first, second) => {
        const position = first.compareDocumentPosition(second);
        return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      })
      .map((control) => control.textContent || control.getAttribute("aria-label"));

    expect(navControlLabels).toEqual([
      "IDE",
      "Dashboard",
      "Extra",
      "Config",
      "Open WebSocket monitor",
    ]);

    fireEvent.click(within(nav).getByRole("button", { name: "Open WebSocket monitor" }));

    const dialog = screen.getByRole("dialog", { name: "WebSocket Monitor" });

    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("No websocket messages yet.")).toHaveClass(
      "overflow-x-hidden",
      "whitespace-pre-wrap",
    );
  });
});
