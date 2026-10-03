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
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { XY_CHART_HISTORY_STORAGE_KEY, XyChartCard, XyChartCardActions, XyChartCardTitle } from "../index.js";
import { WIDGET_CONFIG_STORAGE_KEY } from "../../widgetConfigStore.js";
import { saveXyChartConfig } from "../xyChartConfig.js";

const mockUplot = vi.hoisted(() => ({
  instances: [],
  constructor: vi.fn(function UplotMock(options, data, root) {
    this.options = options;
    this.data = data;
    this.root = root;
    this.setData = vi.fn((nextData) => {
      this.data = nextData;
    });
    this.setSize = vi.fn();
    this.destroy = vi.fn();
    mockUplot.instances.push(this);
    for (const ready of options.hooks?.ready || []) {
      ready(this);
    }
  }),
}));

vi.mock("uplot", () => ({ default: mockUplot.constructor }));

const snapshots = vi.hoisted(() => new Map());
const listeners = vi.hoisted(() => new Map());
const mockConnection = vi.hoisted(() => ({
  wsConnected: true,
  devices: [{ id: "0", name: "PSU1", type: "TCP" }],
  deviceStatuses: { 0: { state: "CONNECTED" } },
  subscribeScpiSnapshot: vi.fn((deviceName, query, listener) => {
    const key = `${deviceName}|${query}`;
    const set = listeners.get(key) || new Set();
    set.add(listener);
    listeners.set(key, set);
    return () => set.delete(listener);
  }),
  getScpiQuerySnapshot: vi.fn(
    (deviceName, query) =>
      snapshots.get(`${deviceName}|${query}`) || { value: "", updatedAt: 0, loading: false, error: "" },
  ),
}));

vi.mock("../../../../connection/ws-proxy/WebSocketConnectionContext.jsx", () => ({
  useWebSocketConnection: () => mockConnection,
}));

const PLACEMENT = { id: "xy-chart-test" };
const X = ["PSU1", "MEAS:VOLT? CH1"];
const Y = ["PSU1", "MEAS:CURR? CH1"];

function publish([deviceName, query], value, updatedAt) {
  const key = `${deviceName}|${query}`;
  snapshots.set(key, { value, updatedAt, loading: false, error: "" });
  act(() => {
    for (const listener of [...(listeners.get(key) || [])]) {
      listener();
    }
  });
}

function configure() {
  saveXyChartConfig(PLACEMENT.id, {
    cardName: "I-V Curve",
    x: { label: "Voltage", unit: "V", deviceName: "PSU1", query: X[1] },
    y: { label: "Current", unit: "A", deviceName: "PSU1", query: Y[1] },
  });
}

describe("XyChartCard", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    snapshots.clear();
    listeners.clear();
    mockConnection.wsConnected = true;
    mockConnection.devices = [{ id: "0", name: "PSU1", type: "TCP" }];
    mockConnection.deviceStatuses = { 0: { state: "CONNECTED" } };
    mockUplot.instances = [];
    mockUplot.constructor.mockClear();
  });

  it("shows the unconfigured placeholder", () => {
    render(<XyChartCard placement={PLACEMENT} />);

    expect(screen.getByText("Configure X and Y devices and SCPI queries.")).toBeInTheDocument();
    expect(mockUplot.constructor).not.toHaveBeenCalled();
  });

  it("uses the configured card name as the title", () => {
    configure();
    render(<XyChartCardTitle placement={PLACEMENT} />);

    expect(screen.getByText("I-V Curve")).toBeInTheDocument();
  });

  it("waits for paired samples, then plots current against voltage", () => {
    configure();
    render(<XyChartCard placement={PLACEMENT} />);

    expect(screen.getByText("Waiting for paired samples.")).toBeInTheDocument();
    expect(screen.getByText("0 / 256 KiB")).toBeInTheDocument();

    publish(X, "1.5", 100);
    publish(Y, "0.25", 110);

    expect(screen.getByTestId("xy-chart-plot")).toBeInTheDocument();
    expect(mockUplot.instances[0].data).toEqual([null, [[1.5], [0.25]]]);
    expect(mockUplot.instances[0].options.axes.map((axis) => axis.label)).toEqual(["Voltage (V)", "Current (A)"]);
    expect(screen.getByText(/^0\.1 \/ 256 KiB$/)).toBeInTheDocument();
    expect(screen.getByText(/MEAS:CURR\? CH1 vs MEAS:VOLT\? CH1/)).toBeInTheDocument();
  });

  it("shows stored points again after the card is mounted again", () => {
    configure();
    const { unmount } = render(<XyChartCard placement={PLACEMENT} />);
    publish(X, "1.5", 100);
    publish(Y, "0.25", 110);
    unmount();
    mockUplot.instances = [];

    render(<XyChartCard placement={PLACEMENT} />);

    expect(screen.getByTestId("xy-chart-plot")).toBeInTheDocument();
    expect(mockUplot.instances[0].data).toEqual([null, [[1.5], [0.25]]]);
  });

  it("reports a disconnected device", () => {
    configure();
    mockConnection.deviceStatuses = { 0: { state: "DISCONNECTED" } };
    render(<XyChartCard placement={PLACEMENT} />);

    expect(screen.getByText(/X: device disconnected/)).toBeInTheDocument();
  });

  it("clears plotted points from the header action", () => {
    configure();
    render(
      <>
        <XyChartCardActions placement={PLACEMENT} />
        <XyChartCard placement={PLACEMENT} />
      </>,
    );
    publish(X, "1.5", 100);
    publish(Y, "0.25", 110);
    expect(screen.getByTestId("xy-chart-plot")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear X-Y chart history" }));

    expect(screen.getByText("Waiting for paired samples.")).toBeInTheDocument();
    expect(window.localStorage.getItem(XY_CHART_HISTORY_STORAGE_KEY)).toBe("{}");
  });

  it("saves settings for both axes under the placement id", () => {
    render(<XyChartCardActions placement={PLACEMENT} />);

    fireEvent.click(screen.getByRole("button", { name: "Configure X-Y chart card" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("X device"), { target: { value: "PSU1" } });
    fireEvent.change(screen.getByLabelText("X SCPI query"), { target: { value: "MEAS:VOLT? CH1" } });
    fireEvent.change(screen.getByLabelText("X label"), { target: { value: "Voltage" } });
    fireEvent.change(screen.getByLabelText("X unit"), { target: { value: "V" } });
    fireEvent.change(screen.getByLabelText("Y device"), { target: { value: "PSU1" } });
    fireEvent.change(screen.getByLabelText("Y SCPI query"), { target: { value: "MEAS:CURR? CH1" } });
    fireEvent.change(screen.getByLabelText("Y label"), { target: { value: "Current" } });
    fireEvent.change(screen.getByLabelText("Y unit"), { target: { value: "A" } });
    fireEvent.change(screen.getByLabelText("Frequency (Hz)"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Pair timeout (ms)"), { target: { value: "300" } });
    fireEvent.change(screen.getByLabelText("History cap (KiB)"), { target: { value: "64" } });
    fireEvent.change(screen.getByLabelText("Card name"), { target: { value: "I-V Curve" } });
    fireEvent.click(screen.getByLabelText("Connect points with a line"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(JSON.parse(window.localStorage.getItem(WIDGET_CONFIG_STORAGE_KEY))).toEqual({
      "xy-chart-test": {
        type: "xyChart",
        cardName: "I-V Curve",
        frequencyHz: 5,
        pairTimeoutMs: 300,
        historyLimitBytes: 65536,
        showLine: false,
        lineColor: "#2563eb",
        showProduct: false,
        productColor: "#dc2626",
        product: { label: "X·Y", unit: "" },
        x: { label: "Voltage", unit: "V", deviceName: "PSU1", query: "MEAS:VOLT? CH1" },
        y: { label: "Current", unit: "A", deviceName: "PSU1", query: "MEAS:CURR? CH1" },
      },
    });
  });

  it("turns the X·Y line on with a toggle and saves its fields", () => {
    saveXyChartConfig(PLACEMENT.id, {
      x: { label: "Voltage", unit: "V", deviceName: "PSU1", query: "MEAS:VOLT? CH1" },
      y: { label: "Current", unit: "A", deviceName: "PSU1", query: "MEAS:CURR? CH1" },
    });
    render(<XyChartCardActions placement={PLACEMENT} />);

    fireEvent.click(screen.getByRole("button", { name: "Configure X-Y chart card" }));
    const toggle = screen.getByRole("button", { name: "Show X·Y line" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByLabelText("X·Y label")).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByLabelText("X·Y label"), { target: { value: "Power" } });
    fireEvent.change(screen.getByLabelText("X·Y unit"), { target: { value: "W" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const saved = JSON.parse(window.localStorage.getItem(WIDGET_CONFIG_STORAGE_KEY))[PLACEMENT.id];
    expect(saved.showProduct).toBe(true);
    expect(saved.product).toEqual({ label: "Power", unit: "W" });
  });

  it("explains the pair timeout from a help button", () => {
    render(<XyChartCardActions placement={PLACEMENT} />);

    fireEvent.click(screen.getByRole("button", { name: "Configure X-Y chart card" }));
    expect(screen.getByLabelText("Pair timeout (ms)")).toHaveValue(1000);

    fireEvent.click(screen.getByRole("button", { name: "What is pair timeout?" }));
    const help = screen.getByRole("dialog", { name: "Pair timeout" });
    expect(help).toHaveTextContent("How long the chart waits for the matching X or Y reading");

    fireEvent.click(within(help).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Pair timeout" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("blocks saving while a query is invalid", () => {
    render(<XyChartCardActions placement={PLACEMENT} />);

    fireEvent.click(screen.getByRole("button", { name: "Configure X-Y chart card" }));
    fireEvent.change(screen.getByLabelText("X device"), { target: { value: "PSU1" } });
    fireEvent.change(screen.getByLabelText("X SCPI query"), { target: { value: "MEAS:VOLT" } });
    fireEvent.change(screen.getByLabelText("Y device"), { target: { value: "PSU1" } });
    fireEvent.change(screen.getByLabelText("Y SCPI query"), { target: { value: "MEAS:CURR? CH1" } });

    expect(screen.getByText(/X: SCPI query must contain a query marker/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
