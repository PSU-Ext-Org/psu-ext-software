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
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearChartImageExportsForTests,
  registerChartImageExport,
  useChartImageExport,
} from "../export/chartExportRegistry.js";

describe("chart export registry", () => {
  afterEach(() => {
    cleanup();
    clearChartImageExportsForTests();
  });

  it("publishes one renderer state to its matching subscriber", () => {
    const exportPng = vi.fn();
    render(<RegistryState exportId="chart-a" />);
    expect(screen.getByLabelText("chart-a")).toHaveTextContent("false:false:false");

    let unregister;
    act(() => {
      unregister = registerChartImageExport("chart-a", { exportPng, ready: true, supported: true });
    });
    expect(screen.getByLabelText("chart-a")).toHaveTextContent("true:true:true");

    act(() => unregister());
    expect(screen.getByLabelText("chart-a")).toHaveTextContent("false:false:false");
  });

  it("isolates simultaneously registered charts", () => {
    render(
      <>
        <RegistryState exportId="chart-a" />
        <RegistryState exportId="chart-b" />
      </>,
    );
    act(() => registerChartImageExport("chart-a", { ready: true, supported: false }));

    expect(screen.getByLabelText("chart-a")).toHaveTextContent("true:false:false");
    expect(screen.getByLabelText("chart-b")).toHaveTextContent("false:false:false");
  });
});

function RegistryState({ exportId }) {
  const state = useChartImageExport(exportId);
  return (
    <output aria-label={exportId}>
      {`${state.ready}:${state.supported}:${Boolean(state.exportPng)}`}
    </output>
  );
}
