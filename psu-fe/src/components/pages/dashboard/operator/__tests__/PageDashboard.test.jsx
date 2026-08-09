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
import { PageDashboard } from "../PageDashboard.jsx";
import { CHART_HISTORY_STORAGE_KEY } from "../../../../widgets/chart";

const mockConnection = vi.hoisted(() => ({
  wsConnected: false,
  devices: [],
  deviceStatuses: {},
  subscribeScpiQuery: vi.fn(() => vi.fn()),
  subscribeScpiSnapshot: vi.fn(() => vi.fn()),
  getScpiQuerySnapshot: vi.fn(() => ({ value: "", updatedAt: 0, loading: false, error: "" })),
  sendScpiCommand: vi.fn(() => Promise.resolve({ ok: true, response: "0" })),
}));

vi.mock("../../../../../connection/ws-proxy/WebSocketConnectionContext.jsx", () => ({
  useWebSocketConnection: () => mockConnection,
}));

describe("PageDashboard", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    mockConnection.subscribeScpiQuery.mockClear();
    mockConnection.subscribeScpiSnapshot.mockClear();
    mockConnection.getScpiQuerySnapshot.mockClear();
    mockConnection.sendScpiCommand.mockClear();
  });

  it("defaults to an empty editable dashboard", () => {
    render(<PageDashboard />);

    expect(screen.getByLabelText("Dashboard widget grid")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("psu-ext.dashboard.operator-layout.v2")).widgets).toEqual([]);
    expect(screen.queryByText("Output")).not.toBeInTheDocument();
    expect(screen.queryByText("Telemetry")).not.toBeInTheDocument();
    expect(screen.queryByText("Limits")).not.toBeInTheDocument();
  });

  it("adds a SingleValueCard from edit mode", () => {
    render(<PageDashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Widget type")).toHaveValue(
      "singleValue:single-value-dashboard:Single Value:1:1",
    );
    fireEvent.click(screen.getByRole("button", { name: "Add selected widget" }));

    expect(screen.getAllByText("Single Value")).toHaveLength(2);
    expect(screen.getByText("Configure a target device and SCPI query.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("psu-ext.dashboard.operator-layout.v2")).widgets[0]).toMatchObject({
      type: "singleValue",
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });
  });

  it("adds ChartCards from edit mode with selectable 2x1, 2x2, and 3x2 placements", () => {
    render(<PageDashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Widget type"), {
      target: { value: "chart:chart-dashboard-small:Chart 2x1:2:1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add selected widget" }));

    expect(screen.getByText("Chart")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("psu-ext.dashboard.operator-layout.v2")).widgets[0]).toMatchObject({
      type: "chart",
      x: 0,
      y: 0,
      w: 2,
      h: 1,
    });

    fireEvent.change(screen.getByLabelText("Widget type"), {
      target: { value: "chart:chart-dashboard-medium:Chart 2x2:2:2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add selected widget" }));

    expect(JSON.parse(window.localStorage.getItem("psu-ext.dashboard.operator-layout.v2")).widgets[1]).toMatchObject({
      type: "chart",
      x: 0,
      y: 1,
      w: 2,
      h: 2,
    });

    fireEvent.change(screen.getByLabelText("Widget type"), {
      target: { value: "chart:chart-dashboard-large:Chart 3x2:3:2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add selected widget" }));

    expect(JSON.parse(window.localStorage.getItem("psu-ext.dashboard.operator-layout.v2")).widgets[2]).toMatchObject({
      type: "chart",
      x: 0,
      y: 3,
      w: 3,
      h: 2,
    });
  });

  it("adds a SingleToggleCard from edit mode", () => {
    render(<PageDashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Widget type"), {
      target: { value: "singleToggle:single-toggle-dashboard:Single Toggle:1:1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add selected widget" }));

    expect(screen.getAllByText("Single Toggle")).toHaveLength(2);
    expect(screen.getByText("Configure a target device and toggle commands.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("psu-ext.dashboard.operator-layout.v2")).widgets[0]).toMatchObject({
      type: "singleToggle",
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });
  });

  it("adds a ProtectionControlCard from edit mode", () => {
    render(<PageDashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Widget type"), {
      target: { value: "protectionControl:protection-dashboard:Protection Control:1:1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add selected widget" }));

    expect(screen.getAllByText("Protection Control")).toHaveLength(2);
    expect(screen.getByText("Configure protection value, trip, and optional enable commands.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("psu-ext.dashboard.operator-layout.v2")).widgets[0]).toMatchObject({
      type: "protectionControl",
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });
  });

  it("adds an ExternalTriggerControlCard from edit mode", () => {
    render(<PageDashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Widget type"), {
      target: { value: "externalTriggerControl:trigger-dashboard:External Triggers 1x2:1:2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add selected widget" }));

    expect(screen.getByText("External Triggers")).toBeInTheDocument();
    expect(screen.getByLabelText("Widget type")).toHaveValue(
      "externalTriggerControl:trigger-dashboard:External Triggers 1x2:1:2",
    );
    expect(screen.getByText("Configure trigger queries, setup command, and action options.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("psu-ext.dashboard.operator-layout.v2")).widgets[0]).toMatchObject({
      type: "externalTriggerControl",
      x: 0,
      y: 0,
      w: 1,
      h: 2,
    });
  });

  it("adds a TimerQueueCard from edit mode as a 2x2 widget", () => {
    render(<PageDashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Widget type"), {
      target: { value: "timerQueueControl:timer-dashboard:Timer Queue 2x2:2:2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add selected widget" }));

    expect(screen.getByText("Timer Queue")).toBeInTheDocument();
    expect(screen.getByText("Configure a target device for this timer queue widget.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("psu-ext.dashboard.operator-layout.v2")).widgets[0]).toMatchObject({
      type: "timerQueueControl",
      x: 0,
      y: 0,
      w: 2,
      h: 2,
    });
  });

  it("deletes chart history when a chart widget is removed", () => {
    window.localStorage.setItem(
      "psu-ext.dashboard.operator-layout.v2",
      JSON.stringify({
        layoutId: "layout-test",
        widgets: [
          {
            id: "chart-dashboard-main",
            type: "chart",
            x: 0,
            y: 0,
            w: 2,
            h: 1,
          },
        ],
      }),
    );
    window.localStorage.setItem(
      CHART_HISTORY_STORAGE_KEY,
      JSON.stringify({
        "chart-dashboard-main": { series: [] },
      }),
    );

    render(<PageDashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete chart-dashboard-main" }));

    expect(JSON.parse(window.localStorage.getItem(CHART_HISTORY_STORAGE_KEY))).not.toHaveProperty(
      "chart-dashboard-main",
    );
  });
});
