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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageDashboardTwo } from "../PageDashboardTwo.jsx";
import { defaultDashboardTwoLayout, defaultDashboardTwoWidgetConfigs } from "../dashboardTwoDefaults.js";
import { loadStoredWidgetConfigs } from "../../../../widgets/widgetConfigStore.js";
import { CHART_HISTORY_STORAGE_KEY } from "../../../../widgets/chart";
import { getAllRunnableWidgetSubscriptions } from "../../../../widgets/widgetConfigRegistry.js";
import { removeOtherWidgetData } from "../otherDashboard.js";
import { XY_CHART_HISTORY_STORAGE_KEY } from "../../../../widgets/xyChart";

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

describe("PageDashboardTwo", () => {
  beforeEach(() => {
    window.localStorage.setItem("psu-ext.dashboard.other-layout.v1", JSON.stringify({
      layoutId: "existing-empty", widgets: [],
    }));
  });

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

  it("initializes the supplied Power chart and polling settings without history", () => {
    window.localStorage.clear();
    render(<PageDashboardTwo />);

    expect(screen.getByRole("heading", { name: "Power" })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem("psu-ext.dashboard.other-layout.v1")).widgets)
      .toEqual(defaultDashboardTwoLayout);
    expect(loadStoredWidgetConfigs()).toEqual(defaultDashboardTwoWidgetConfigs);
    expect(getAllRunnableWidgetSubscriptions()).toEqual([
      expect.objectContaining({
        deviceName: "PSUEXT1", query: "MEAS:POWER:DATA? CH1", frequencyHz: 1,
      }),
    ]);
    const history = JSON.parse(localStorage.getItem(CHART_HISTORY_STORAGE_KEY) || "{}");
    for (const chart of Object.values(history)) {
      expect(chart.series.every((series) => series.points.length === 0)).toBe(true);
    }
  });

  it("preserves an intentionally empty saved dashboard", () => {
    render(<PageDashboardTwo />);
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(loadStoredWidgetConfigs()).toEqual({});
  });

  it("preserves saved chart settings", () => {
    const id = defaultDashboardTwoLayout[0].id;
    const config = { ...defaultDashboardTwoWidgetConfigs[id], cardName: "Custom Power" };
    localStorage.setItem("psu-ext.dashboard.other-layout.v1", JSON.stringify({
      layoutId: "custom-layout", widgets: defaultDashboardTwoLayout,
    }));
    localStorage.setItem("psu-ext.widget-configs.v1", JSON.stringify({ [id]: config }));
    render(<PageDashboardTwo />);
    expect(screen.getByRole("heading", { name: "Custom Power" })).toBeInTheDocument();
    expect(loadStoredWidgetConfigs()).toEqual({ [id]: config });
  });

  it("restores the default chart and missing settings on reset", () => {
    render(<PageDashboardTwo />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(JSON.parse(localStorage.getItem("psu-ext.dashboard.other-layout.v1")).widgets)
      .toEqual(defaultDashboardTwoLayout);
    expect(loadStoredWidgetConfigs()).toEqual(defaultDashboardTwoWidgetConfigs);
  });

  it("shows the configurable single-value placeholder", () => {
    render(<PageDashboardTwo />);

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
    render(<PageDashboardTwo />);

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

  it("deletes X-Y chart history when an X-Y chart widget is removed", () => {
    window.localStorage.setItem(
      XY_CHART_HISTORY_STORAGE_KEY,
      JSON.stringify({ "xy-removed": { points: [] }, "xy-kept": { points: [] } }),
    );

    removeOtherWidgetData({ id: "xy-removed", type: "xyChart" });

    const histories = JSON.parse(window.localStorage.getItem(XY_CHART_HISTORY_STORAGE_KEY));
    expect(histories).not.toHaveProperty("xy-removed");
    expect(histories).toHaveProperty("xy-kept");
  });

  it("adds X-Y charts from edit mode with selectable 2x2 and 3x2 placements", () => {
    render(<PageDashboardTwo />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Widget type"), {
      target: { value: "xyChart:xy-chart-other-medium:XY Chart 2x2:2:2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add selected widget" }));

    expect(screen.getByText("X-Y Chart")).toBeInTheDocument();
    expect(screen.getByText("Configure X and Y devices and SCPI queries.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("psu-ext.dashboard.other-layout.v1")).widgets[0]).toMatchObject({
      type: "xyChart",
      x: 0,
      y: 0,
      w: 2,
      h: 2,
    });

    fireEvent.change(screen.getByLabelText("Widget type"), {
      target: { value: "xyChart:xy-chart-other-large:XY Chart 3x2:3:2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add selected widget" }));

    expect(JSON.parse(window.localStorage.getItem("psu-ext.dashboard.other-layout.v1")).widgets[1]).toMatchObject({
      type: "xyChart",
      w: 3,
      h: 2,
    });
  });
});
