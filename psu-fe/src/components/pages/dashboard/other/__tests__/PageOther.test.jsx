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
import { PageOther } from "../PageOther.jsx";

const mockConnection = vi.hoisted(() => ({
  wsConnected: false,
  deviceConnected: false,
  deviceIdentity: {
    name: "",
    error: null,
  },
  subscribeScpiQuery: vi.fn(() => vi.fn()),
  subscribeScpiSnapshot: vi.fn(() => vi.fn()),
  getScpiQuerySnapshot: vi.fn(() => ({ value: "", updatedAt: 0, loading: false, error: "" })),
}));

vi.mock("../../../../../connection/ws-proxy/WebSocketConnectionContext.jsx", () => ({
  useWebSocketConnection: () => mockConnection,
}));

describe("PageOther", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    mockConnection.wsConnected = false;
    mockConnection.deviceConnected = false;
    mockConnection.deviceIdentity = {
      name: "",
      error: null,
    };
    mockConnection.subscribeScpiQuery.mockClear();
    mockConnection.subscribeScpiSnapshot.mockClear();
    mockConnection.getScpiQuerySnapshot.mockClear();
  });

  it("renders the other widgets through the reusable dashboard shell", () => {
    render(<PageOther />);

    expect(screen.getByLabelText("Dashboard widget grid")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("psu-ext.dashboard.other-layout.v1")).widgets).toEqual([]);
    expect(screen.queryByText("Single Value")).not.toBeInTheDocument();
    expect(screen.queryByText("Control")).not.toBeInTheDocument();
    expect(screen.queryByText("WebSocket Proxy")).not.toBeInTheDocument();
    expect(screen.queryByText("Device Link")).not.toBeInTheDocument();
    expect(screen.queryByText("Telemetry")).not.toBeInTheDocument();
    expect(screen.queryByText("Workflows")).not.toBeInTheDocument();
  });

  it("shows the configurable single-value placeholder", () => {
    render(<PageOther />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Widget type")).toHaveValue("singleValue:single-value-other:Single Value:1:1");
    fireEvent.click(screen.getByRole("button", { name: "Add selected widget" }));

    expect(screen.getAllByText("Single Value")).toHaveLength(2);
    expect(screen.getByText("Configure a target device and SCPI query.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Configure" })).toHaveLength(1);
    expect(JSON.parse(window.localStorage.getItem("psu-ext.dashboard.other-layout.v1")).widgets[0]).toMatchObject({
      type: "singleValue",
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });
  });

  it("adds chart placeholders with selectable 2x1, 2x2, and 3x2 placements", () => {
    render(<PageOther />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Widget type"), {
      target: { value: "chart:chart-other-small:Chart 2x1:2:1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add selected widget" }));

    expect(screen.getByText("Chart")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("psu-ext.dashboard.other-layout.v1")).widgets[0]).toMatchObject({
      type: "chart",
      x: 0,
      y: 0,
      w: 2,
      h: 1,
    });

    fireEvent.change(screen.getByLabelText("Widget type"), {
      target: { value: "chart:chart-other-medium:Chart 2x2:2:2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add selected widget" }));

    expect(JSON.parse(window.localStorage.getItem("psu-ext.dashboard.other-layout.v1")).widgets[1]).toMatchObject({
      type: "chart",
      x: 0,
      y: 1,
      w: 2,
      h: 2,
    });

    fireEvent.change(screen.getByLabelText("Widget type"), {
      target: { value: "chart:chart-other-large:Chart 3x2:3:2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add selected widget" }));

    expect(JSON.parse(window.localStorage.getItem("psu-ext.dashboard.other-layout.v1")).widgets[2]).toMatchObject({
      type: "chart",
      x: 0,
      y: 3,
      w: 3,
      h: 2,
    });
  });
});
