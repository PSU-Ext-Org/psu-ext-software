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
import { SCRIPT_RESULT_CHART_STATISTICS_STORAGE_KEY } from "../scriptResultChartStatisticsConfig.js";
import { ScriptResultChart } from "../components/ScriptResultChart.jsx";

vi.mock("../hooks/useScriptResultSeriesData.js", () => ({
  useScriptResultSeriesData: () => ({
    rendererKey: "result-chart",
    seriesData: [],
    statusText: "Loaded 0 points",
    unit: "V",
    usageText: "0 points",
  }),
}));

vi.mock("../components/ChartView.jsx", () => ({
  ChartView: ({ config }) => <output aria-label="Rendered statistics">{JSON.stringify(config.statistics)}</output>,
}));

describe("ScriptResultChart", () => {
  afterEach(() => { cleanup(); window.localStorage.clear(); });

  it("saves the focused statistics dialog through its parent close callback", () => {
    const onSettingsOpenChange = vi.fn();
    render(<ScriptResultChart onSettingsOpenChange={onSettingsOpenChange} seriesNames={["voltage", "current"]} settingsOpen taskApiUrl="http://runner.test/tasks" taskId="task-12345" />);
    expect(screen.getByRole("dialog", { name: "Result Chart Statistics" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show statistics" }));
    expect(screen.getByLabelText("Statistics series")).toHaveValue("script-result-voltage");
    fireEvent.click(screen.getByRole("checkbox", { name: "Show Average" }));
    fireEvent.change(screen.getByLabelText("Statistics series"), { target: { value: "script-result-current" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByLabelText("Rendered statistics")).toHaveTextContent('"showStatistics":true');
    expect(onSettingsOpenChange).toHaveBeenCalledWith(false);
    expect(JSON.parse(window.localStorage.getItem(SCRIPT_RESULT_CHART_STATISTICS_STORAGE_KEY))).toMatchObject({
      showStatistics: true,
      seriesId: "script-result-current",
      enabledStats: { avg: true },
    });
  });

  it("discards changes when settings are cancelled", () => {
    const onSettingsOpenChange = vi.fn();
    render(<ScriptResultChart onSettingsOpenChange={onSettingsOpenChange} seriesNames={["voltage"]} settingsOpen taskApiUrl="http://runner.test/tasks" taskId="task-12345" />);
    fireEvent.click(screen.getByRole("button", { name: "Show statistics" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(window.localStorage.getItem(SCRIPT_RESULT_CHART_STATISTICS_STORAGE_KEY)).toBeNull();
    expect(screen.getByLabelText("Rendered statistics")).toHaveTextContent('"showStatistics":false');
    expect(onSettingsOpenChange).toHaveBeenCalledWith(false);
  });
});
