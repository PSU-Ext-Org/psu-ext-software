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
import { fileURLToPath, URL } from "node:url";

const CHART_RENDERERS = Object.freeze({
  svg: "./ChartRendererSvg.jsx",
  uplot: "./ChartRendererUplot.jsx",
});

/**
 * Normalizes the configured chart renderer key.
 *
 * @param {string | undefined | null} [value]
 * @returns {"svg" | "uplot"}
 */
export function resolveChartRenderer(value = process.env.PSU_CHART_RENDERER) {
  const renderer = String(value || "uplot").trim().toLowerCase();
  return Object.hasOwn(CHART_RENDERERS, renderer) ? renderer : "uplot";
}

/**
 * Resolves the configured chart renderer module path for Vite aliasing.
 *
 * @param {string | undefined | null} [value]
 * @returns {string}
 */
export function resolveChartRendererModulePath(value = process.env.PSU_CHART_RENDERER) {
  return CHART_RENDERERS[resolveChartRenderer(value)];
}

export const chartRendererAlias = fileURLToPath(
  new URL(resolveChartRendererModulePath(), import.meta.url),
);
