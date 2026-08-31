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
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartCard, ChartCardActions } from "../components/ChartCard.jsx";
import { WIDGET_CONFIG_STORAGE_KEY } from "../../widgetConfigStore.js";
import {
  CHART_HISTORY_STORAGE_KEY,
  saveChartHistory,
} from "../storage/chartHistoryStorage.js";

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

vi.mock("uplot", () => ({
  default: mockUplot.constructor,
}));

const mockConnection = vi.hoisted(() => ({
  wsConnected: true,
  devices: [{ id: "0", name: "PSU1", type: "TCP" }],
  deviceStatuses: { 0: { state: "CONNECTED" } },
  subscribeScpiSnapshot: vi.fn(() => vi.fn()),
  getScpiQuerySnapshot: vi.fn(() => ({
    value: "12.04",
    updatedAt: 1000,
    loading: false,
    error: "",
  })),
}));

vi.mock("../../../../connection/ws-proxy/WebSocketConnectionContext.jsx", () => ({
  useWebSocketConnection: () => mockConnection,
}));

describe("ChartCard", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
    mockConnection.wsConnected = true;
    mockConnection.devices = [{ id: "0", name: "PSU1", type: "TCP" }];
    mockConnection.deviceStatuses = { 0: { state: "CONNECTED" } };
    mockConnection.subscribeScpiSnapshot.mockReset();
    mockConnection.subscribeScpiSnapshot.mockReturnValue(vi.fn());
    mockConnection.getScpiQuerySnapshot.mockReset();
    mockConnection.getScpiQuerySnapshot.mockReturnValue({
      value: "12.04",
      updatedAt: 1000,
      loading: false,
      error: "",
    });
    mockUplot.instances = [];
    mockUplot.constructor.mockClear();
  });

  it("shows the unconfigured placeholder", () => {
    render(<ChartCard placement={{ id: "chart-home-main" }} />);

    expect(screen.getByText("Configure a target device and SCPI query.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Configure" })).not.toBeInTheDocument();
  });

  it("keeps header export disabled until its chart has numeric samples", () => {
    const placement = { id: "chart-home-main" };
    const { rerender } = render(<ChartCardActions placement={placement} />);
    expect(screen.getByRole("button", { name: "Export chart as PNG" })).toBeDisabled();

    saveChartConfig("chart-home-main", [{
      id: "voltage",
      label: "Voltage",
      deviceName: "PSU1",
      query: "MEAS:VOLT? CH1",
      lineColor: "#2563eb",
    }]);
    rerender(<><ChartCardActions placement={placement} /><ChartCard placement={placement} /></>);

    expect(screen.getByRole("button", { name: "Export chart as PNG" })).toBeEnabled();
  });

  it("saves chart settings under the placement id", () => {
    render(<ChartCardActions placement={{ id: "chart-home-main" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Configure chart card" }));
    fireEvent.change(screen.getByLabelText("Device"), { target: { value: "PSU1" } });
    fireEvent.change(screen.getByLabelText("SCPI query"), { target: { value: "MEAS:VOLT? CH1" } });
    fireEvent.change(screen.getByLabelText("Frequency (Hz)"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "V" } });
    fireEvent.change(screen.getByLabelText("History cap (KiB)"), { target: { value: "64" } });
    fireEvent.click(screen.getByRole("button", { name: "Show statistics" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Show Average" }));
    fireEvent.change(screen.getByLabelText("Card name"), { target: { value: "Voltage Trend" } });
    fireEvent.change(screen.getByLabelText("Line label"), { target: { value: "Voltage" } });
    fireEvent.change(screen.getByLabelText("Color"), { target: { value: "#dc2626" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(JSON.parse(window.localStorage.getItem(WIDGET_CONFIG_STORAGE_KEY))).toMatchObject({
      "chart-home-main": {
        type: "chart",
        cardName: "Voltage Trend",
        frequencyHz: 2,
        historyLimitBytes: 65536,
        unit: "V",
        statistics: {
          showStatistics: true,
          seriesId: "series-1",
          enabledStats: {
            count: false,
            avg: true,
            median: false,
            min: true,
            max: true,
            ripplePeakToPeak: true,
            rippleRms: false,
            typicalRippleP95P5: false,
            stdDev: false,
            maxDelta: false,
            avgDelta: false,
            trendPerSecond: false,
            drift: false,
            spikeCount: false,
            frequencyHz: false,
            periodSeconds: false,
          },
        },
        series: [
          {
            id: "series-1",
            label: "Voltage",
            deviceName: "PSU1",
            query: "MEAS:VOLT? CH1",
            lineColor: "#dc2626",
          },
        ],
      },
    });
  });

  it("blocks history caps above 256 KiB", () => {
    render(<ChartCardActions placement={{ id: "chart-home-main" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Configure chart card" }));
    fireEvent.change(screen.getByLabelText("Device"), { target: { value: "PSU1" } });
    fireEvent.change(screen.getByLabelText("SCPI query"), { target: { value: "MEAS:VOLT? CH1" } });
    fireEvent.change(screen.getByLabelText("History cap (KiB)"), { target: { value: "300" } });

    expect(screen.getByText("History cap must be between 1 KiB and 256 KiB.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("renders numeric samples through the configured renderer", () => {
    saveChartConfig("chart-home-main", [
      {
        id: "voltage",
        label: "Voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT? CH1",
        lineColor: "#2563eb",
      },
    ]);

    render(<ChartCard placement={{ id: "chart-home-main" }} />);

    expect(screen.getByTestId("chart-plot")).toBeInTheDocument();
    expect(screen.getByText(/PSU1 MEAS:VOLT\? CH1/)).toBeInTheDocument();
    expect(mockUplot.constructor).toHaveBeenCalled();
    expect(mockConnection.subscribeScpiSnapshot).toHaveBeenCalledWith(
      "PSU1",
      "MEAS:VOLT? CH1",
      expect.any(Function),
    );
  });

  it("restores persisted history on mount", () => {
    const series = [
      {
        id: "voltage",
        label: "Voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT? CH1",
        lineColor: "#2563eb",
      },
    ];
    saveChartConfig("chart-home-main", series);
    saveChartHistory("chart-home-main", { series }, [
      {
        id: "voltage",
        label: "Voltage",
        color: "#2563eb",
        points: [
          { t: 1000, y: 12.04 },
          { t: 2000, y: 12.24 },
        ],
      },
    ]);
    mockConnection.getScpiQuerySnapshot.mockReturnValue({
      value: "",
      updatedAt: 0,
      loading: false,
      error: "",
    });

    render(<ChartCard placement={{ id: "chart-home-main" }} />);

    expect(screen.getByTestId("chart-plot")).toBeInTheDocument();
    expect(screen.getByText(/\/ 256 KiB/)).toBeInTheDocument();
    expect(mockUplot.instances[0].data[0]).toEqual([1, 2]);
  });

  it("appends samples from snapshot notifications", async () => {
    let snapshot = {
      value: "12.04",
      updatedAt: 1000,
      loading: false,
      error: "",
    };
    let snapshotListener = null;
    mockConnection.getScpiQuerySnapshot.mockImplementation(() => snapshot);
    mockConnection.subscribeScpiSnapshot.mockImplementation((_deviceName, _query, listener) => {
      snapshotListener = listener;
      return vi.fn();
    });
    saveChartConfig("chart-home-main", [
      {
        id: "voltage",
        label: "Voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT? CH1",
        lineColor: "#2563eb",
      },
    ]);

    render(<ChartCard placement={{ id: "chart-home-main" }} />);
    const initialInstance = mockUplot.instances[0];

    snapshot = {
      value: "12.24",
      updatedAt: 2000,
      loading: false,
      error: "",
    };
    act(() => {
      snapshotListener();
    });

    await waitFor(() =>
      expect(initialInstance.setData).toHaveBeenCalledWith([
        [1, 2],
        [12.04, 12.24],
      ]),
    );
    expect(mockUplot.instances.at(-1)).toBe(initialInstance);
    expect(JSON.parse(window.localStorage.getItem(CHART_HISTORY_STORAGE_KEY))).toHaveProperty(
      "chart-home-main",
    );
  });

  it("merges overlapping binary DATA intervals without duplicate readings", async () => {
    let snapshot = {
      value: "12.24",
      points: [
        { t: 4900, y: 12.04, sourceT: 1000 },
        { t: 5000, y: 12.24, sourceT: 1100 },
      ],
      updatedAt: 5000,
      loading: false,
      error: "",
    };
    let snapshotListener = null;
    mockConnection.getScpiQuerySnapshot.mockImplementation(() => snapshot);
    mockConnection.subscribeScpiSnapshot.mockImplementation((_deviceName, _query, listener) => {
      snapshotListener = listener;
      return vi.fn();
    });
    saveChartConfig("chart-home-main", [
      {
        id: "voltage",
        label: "Voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT:DATA? CH1",
        lineColor: "#2563eb",
      },
    ]);

    render(<ChartCard placement={{ id: "chart-home-main" }} />);
    const initialInstance = mockUplot.instances[0];

    snapshot = {
      value: "12.44",
      points: [
        { t: 5000, y: 12.24, sourceT: 1100 },
        { t: 5100, y: 12.44, sourceT: 1200 },
      ],
      updatedAt: 5100,
      loading: false,
      error: "",
    };
    act(() => {
      snapshotListener();
    });

    await waitFor(() =>
      expect(initialInstance.setData).toHaveBeenCalledWith([
        [4.9, 5, 5.1],
        [12.04, 12.24, 12.44],
      ]),
    );
    expect(JSON.parse(window.localStorage.getItem(CHART_HISTORY_STORAGE_KEY))).toMatchObject({
      "chart-home-main": {
        series: [
          {
            points: [
              { t: 4900, y: 12.04, sourceT: 1000 },
              { t: 5000, y: 12.24, sourceT: 1100 },
              { t: 5100, y: 12.44, sourceT: 1200 },
            ],
          },
        ],
      },
    });
  });

  it("keeps chart histories isolated by widget id", () => {
    const series = [
      {
        id: "voltage",
        label: "Voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT? CH1",
        lineColor: "#2563eb",
      },
    ];
    saveChartConfig("chart-home-main", series);
    saveChartConfig("chart-home-other", series);
    saveChartHistory("chart-home-other", { series }, [
      {
        id: "voltage",
        label: "Voltage",
        color: "#2563eb",
        points: [
          { t: 1000, y: 11 },
          { t: 2000, y: 12 },
        ],
      },
    ]);
    mockConnection.getScpiQuerySnapshot.mockReturnValue({
      value: "",
      updatedAt: 0,
      loading: false,
      error: "",
    });

    render(<ChartCard placement={{ id: "chart-home-main" }} />);

    expect(screen.getByText("Waiting for numeric samples.")).toBeInTheDocument();
  });

  it("clears visible and persisted history from the chart action", () => {
    const series = [
      {
        id: "voltage",
        label: "Voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT? CH1",
        lineColor: "#2563eb",
      },
    ];
    saveChartConfig("chart-home-main", series);
    saveChartHistory("chart-home-main", { series }, [
      {
        id: "voltage",
        label: "Voltage",
        color: "#2563eb",
        points: [
          { t: 1000, y: 12.04 },
          { t: 2000, y: 12.24 },
        ],
      },
    ]);
    mockConnection.getScpiQuerySnapshot.mockReturnValue({
      value: "",
      updatedAt: 0,
      loading: false,
      error: "",
    });

    render(
      <>
        <ChartCardActions placement={{ id: "chart-home-main" }} />
        <ChartCard placement={{ id: "chart-home-main" }} />
      </>,
    );
    expect(screen.getByTestId("chart-plot")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear chart history" }));

    expect(screen.getByText("Waiting for numeric samples.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(CHART_HISTORY_STORAGE_KEY))).not.toHaveProperty(
      "chart-home-main",
    );
  });

  it("renders again when a new sample arrives after clearing history", async () => {
    const series = [
      {
        id: "voltage",
        label: "Voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT? CH1",
        lineColor: "#2563eb",
      },
    ];
    let snapshot = {
      value: "",
      updatedAt: 0,
      loading: false,
      error: "",
    };
    let snapshotListener = null;
    mockConnection.getScpiQuerySnapshot.mockImplementation(() => snapshot);
    mockConnection.subscribeScpiSnapshot.mockImplementation((_deviceName, _query, listener) => {
      snapshotListener = listener;
      return vi.fn();
    });
    saveChartConfig("chart-home-main", series);
    saveChartHistory("chart-home-main", { series }, [
      {
        id: "voltage",
        label: "Voltage",
        color: "#2563eb",
        points: [
          { t: 1000, y: 12.04 },
          { t: 2000, y: 12.24 },
        ],
      },
    ]);

    render(
      <>
        <ChartCardActions placement={{ id: "chart-home-main" }} />
        <ChartCard placement={{ id: "chart-home-main" }} />
      </>,
    );
    expect(screen.getByTestId("chart-plot")).toBeInTheDocument();
    const initialInstance = mockUplot.instances[0];

    fireEvent.click(screen.getByRole("button", { name: "Clear chart history" }));
    expect(screen.getByText("Waiting for numeric samples.")).toBeInTheDocument();
    expect(mockConnection.subscribeScpiSnapshot).toHaveBeenCalledTimes(2);

    snapshot = {
      value: "12.5",
      updatedAt: 3000,
      loading: false,
      error: "",
    };
    act(() => {
      snapshotListener();
    });

    await waitFor(() => expect(screen.getByTestId("chart-plot")).toBeInTheDocument());
    expect(initialInstance.destroy).toHaveBeenCalled();
    expect(mockUplot.instances.at(-1)).not.toBe(initialInstance);
    expect(mockUplot.instances.at(-1).data).toEqual([[3], [12.5]]);
  });

  it("shows statistics only when enabled and renders the default visible stats", () => {
    saveChartConfig("chart-home-main", [
      {
        id: "voltage",
        label: "Voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT? CH1",
        lineColor: "#2563eb",
      },
    ], 256 * 1024, {
      showStatistics: true,
    });

    render(<ChartCard placement={{ id: "chart-home-main" }} />);

    expect(screen.getByTestId("chart-statistics")).toBeInTheDocument();
    expect(screen.getByText("Voltage stats")).toBeInTheDocument();
    expect(screen.getByText("Min")).toBeInTheDocument();
    expect(screen.getAllByText("12.0400 V")).toHaveLength(2);
    expect(screen.getByText("Max")).toBeInTheDocument();
    expect(screen.getByText("Ripple p-p")).toBeInTheDocument();
    expect(screen.getByText("0.0000 V")).toBeInTheDocument();
    expect(screen.queryByText("Average")).not.toBeInTheDocument();
    expect(screen.queryByText("Delta")).not.toBeInTheDocument();
  });

  it("shows a statistics series selector when multiple series exist and statistics are enabled", () => {
    saveChartConfig(
      "chart-home-main",
      [
        {
          id: "voltage",
          label: "Voltage",
          deviceName: "PSU1",
          query: "MEAS:VOLT? CH1",
          lineColor: "#2563eb",
        },
        {
          id: "current",
          label: "Current",
          deviceName: "PSU1",
          query: "MEAS:CURR? CH1",
          lineColor: "#0f766e",
        },
      ],
      256 * 1024,
      { showStatistics: true, seriesId: "current" },
    );

    render(<ChartCardActions placement={{ id: "chart-home-main" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Configure chart card" }));

    expect(screen.getByLabelText("Statistics series")).toBeInTheDocument();
    expect(screen.getByLabelText("Statistics series")).toHaveValue("current");
  });

  it("shows statistic calculation details from the info button", () => {
    render(<ChartCardActions placement={{ id: "chart-home-main" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Configure chart card" }));
    fireEvent.click(screen.getByRole("button", { name: "Show statistics" }));
    fireEvent.click(screen.getByRole("button", { name: "Average calculation details" }));

    const infoDialog = screen.getByRole("dialog", { name: "Average calculation details" });
    expect(infoDialog).toBeInTheDocument();
    expect(within(infoDialog).getByText("Average")).toBeInTheDocument();
    expect(within(infoDialog).getByText("The arithmetic mean of the stored sample values in the selected series.")).toBeInTheDocument();
    expect(within(infoDialog).getByText("Formula")).toBeInTheDocument();
    expect(within(infoDialog).getByText("avg = (sum of all sample values) / N")).toBeInTheDocument();
    expect(within(infoDialog).getByText("How it is calculated")).toBeInTheDocument();
    expect(within(infoDialog).getByText("Sum all sample values in the selected series.")).toBeInTheDocument();
    expect(within(infoDialog).getByText("Divide that sum by the sample count N.")).toBeInTheDocument();

    fireEvent.click(within(infoDialog).getByRole("button", { name: "Close" }));

    expect(screen.queryByText("The arithmetic mean of the stored sample values in the selected series.")).not.toBeInTheDocument();
  });

  it("resets history when a series keeps its id but changes query", () => {
    const originalSeries = [
      {
        id: "voltage",
        label: "Voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT? CH1",
        lineColor: "#2563eb",
      },
    ];
    const changedSeries = [{ ...originalSeries[0], query: "MEAS:CURR? CH1" }];
    saveChartConfig("chart-home-main", changedSeries);
    saveChartHistory("chart-home-main", { series: originalSeries }, [
      {
        id: "voltage",
        label: "Voltage",
        color: "#2563eb",
        points: [
          { t: 1000, y: 12.04 },
          { t: 2000, y: 12.24 },
        ],
      },
    ]);
    mockConnection.getScpiQuerySnapshot.mockReturnValue({
      value: "",
      updatedAt: 0,
      loading: false,
      error: "",
    });

    render(<ChartCard placement={{ id: "chart-home-main" }} />);

    expect(screen.getByText("Waiting for numeric samples.")).toBeInTheDocument();
  });

  it("ignores non-numeric samples", () => {
    mockConnection.getScpiQuerySnapshot.mockReturnValue({
      value: "not-a-number",
      updatedAt: 1000,
      loading: false,
      error: "",
    });
    saveChartConfig("chart-home-main", [
      {
        id: "voltage",
        label: "Voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT? CH1",
        lineColor: "#2563eb",
      },
    ]);

    render(<ChartCard placement={{ id: "chart-home-main" }} />);

    expect(screen.getByText("Waiting for numeric samples.")).toBeInTheDocument();
    expect(screen.queryByTestId("chart-plot")).not.toBeInTheDocument();
  });

  it("renders multiple configured series through the array data path", () => {
    mockConnection.getScpiQuerySnapshot.mockImplementation((deviceName, query) => ({
      value: query.includes("CURR") ? "1.5" : "12.04",
      updatedAt: query.includes("CURR") ? 2000 : 1000,
      loading: false,
      error: "",
      deviceName,
    }));
    saveChartConfig("chart-home-main", [
      {
        id: "voltage",
        label: "Voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT? CH1",
        lineColor: "#2563eb",
      },
      {
        id: "current",
        label: "Current",
        deviceName: "PSU1",
        query: "MEAS:CURR? CH1",
        lineColor: "#0f766e",
      },
    ]);

    render(<ChartCard placement={{ id: "chart-home-main" }} />);

    expect(screen.getByTestId("chart-plot")).toBeInTheDocument();
    expect(mockUplot.instances[0].data).toHaveLength(3);
    expect(mockConnection.subscribeScpiSnapshot).toHaveBeenCalledTimes(2);
  });

  it("discards older points when the configured history cap is reached", async () => {
    let snapshot = {
      value: "1.0",
      updatedAt: 1000,
      loading: false,
      error: "",
    };
    let snapshotListener = null;
    mockConnection.getScpiQuerySnapshot.mockImplementation(() => snapshot);
    mockConnection.subscribeScpiSnapshot.mockImplementation((_deviceName, _query, listener) => {
      snapshotListener = listener;
      return vi.fn();
    });
    saveChartConfig("chart-home-main", [
      {
        id: "voltage",
        label: "Voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT? CH1",
        lineColor: "#2563eb",
      },
    ], 1024);

    render(<ChartCard placement={{ id: "chart-home-main" }} />);

    for (let index = 2; index <= 80; index += 1) {
      snapshot = {
        value: String(index),
        updatedAt: index * 1000,
        loading: false,
        error: "",
      };
      act(() => {
        snapshotListener();
      });
    }

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(CHART_HISTORY_STORAGE_KEY));
      const points = stored["chart-home-main"].series[0].points;
      expect(JSON.stringify(stored["chart-home-main"]).length).toBeLessThanOrEqual(1024);
      expect(points.at(-1)).toMatchObject({ t: 80000, y: 80 });
      expect(points[0].t).toBeGreaterThan(1000);
    });
  });
});

function saveChartConfig(widgetId, series, historyLimitBytes = 256 * 1024, statistics = {}) {
  const current = JSON.parse(window.localStorage.getItem(WIDGET_CONFIG_STORAGE_KEY) || "{}");
  window.localStorage.setItem(
    WIDGET_CONFIG_STORAGE_KEY,
    JSON.stringify({
      ...current,
      [widgetId]: {
        type: "chart",
        cardName: "Voltage Trend",
        unit: "V",
        frequencyHz: 1,
        historyLimitBytes,
        statistics,
        series,
      },
    }),
  );
}
