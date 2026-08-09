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
import { describe, expect, it } from "vitest";
import {
  chartRendererAlias,
  resolveChartRenderer,
  resolveChartRendererModulePath,
} from "../renderers/chartRendererSelection.js";

describe("chartRendererSelection", () => {
  it("returns svg when explicitly selected", () => {
    expect(resolveChartRenderer("svg")).toBe("svg");
    expect(resolveChartRendererModulePath("svg")).toBe("./ChartRendererSvg.jsx");
  });

  it("returns uplot when explicitly selected", () => {
    expect(resolveChartRenderer("uplot")).toBe("uplot");
    expect(resolveChartRendererModulePath("uplot")).toBe("./ChartRendererUplot.jsx");
  });

  it("falls back to uplot when no value is provided", () => {
    expect(resolveChartRenderer(undefined)).toBe("uplot");
    expect(resolveChartRendererModulePath(undefined)).toBe("./ChartRendererUplot.jsx");
  });

  it("falls back to uplot for invalid values", () => {
    expect(resolveChartRenderer("canvas")).toBe("uplot");
    expect(resolveChartRendererModulePath("canvas")).toBe("./ChartRendererUplot.jsx");
  });

  it("normalizes whitespace and casing", () => {
    expect(resolveChartRenderer("  SVG  ")).toBe("svg");
    expect(resolveChartRenderer("  UpLoT ")).toBe("uplot");
  });

  it("exports an absolute alias path for the default renderer", () => {
    expect(chartRendererAlias).toContain("ChartRendererUplot.jsx");
  });
});
