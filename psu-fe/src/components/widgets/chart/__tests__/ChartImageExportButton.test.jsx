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
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartImageExportButton } from "../components/ChartImageExportButton.jsx";
import { clearChartImageExportsForTests, registerChartImageExport } from "../export/chartExportRegistry.js";

describe("ChartImageExportButton", () => {
  afterEach(() => {
    cleanup();
    clearChartImageExportsForTests();
  });

  it("stays disabled until its chart has samples", () => {
    render(<ChartImageExportButton exportId="chart-a" />);
    expect(screen.getByRole("button", { name: "Export chart as PNG" })).toBeDisabled();
  });

  it("shows the required unsupported popup", () => {
    act(() => registerChartImageExport("chart-a", { ready: true, supported: false }));
    render(<ChartImageExportButton exportId="chart-a" />);
    fireEvent.click(screen.getByRole("button", { name: "Export chart as PNG" }));
    expect(screen.getByRole("dialog", { name: "Chart export" })).toHaveTextContent("Export not supported yet");
  });

  it("disables while exporting and reports failures", async () => {
    let rejectExport;
    const exportPng = vi.fn(() => new Promise((_resolve, reject) => { rejectExport = reject; }));
    act(() => registerChartImageExport("chart-a", { exportPng, ready: true, supported: true }));
    render(<ChartImageExportButton exportId="chart-a" />);
    const button = screen.getByRole("button", { name: "Export chart as PNG" });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(exportPng).toHaveBeenCalledOnce();

    act(() => rejectExport(new Error("encode failed")));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Chart export" })).toHaveTextContent("Chart image export failed."));
    expect(button).toBeEnabled();
  });
});
