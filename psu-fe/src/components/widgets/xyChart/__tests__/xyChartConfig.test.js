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
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_CHART_HISTORY_LIMIT_BYTES, MAX_CHART_HISTORY_BYTES } from "../../chart/storage/chartHistoryStorage.js";
import {
  DEFAULT_XY_CHART_CONFIG,
  isXyChartConfigured,
  loadRunnableXySubscriptions,
  loadXyChartConfig,
  MAX_PAIR_TIMEOUT_MS,
  MIN_PAIR_TIMEOUT_MS,
  normalizeXyChartConfig,
  saveXyChartConfig,
} from "../xyChartConfig.js";

const CONFIGURED = {
  cardName: "I-V Curve",
  frequencyHz: 5,
  pairTimeoutMs: 500,
  historyLimitBytes: 64 * 1024,
  showLine: false,
  lineColor: "#dc2626",
  showProduct: true,
  productColor: "#16a34a",
  product: { label: "Power", unit: "W" },
  x: { label: "Voltage", unit: "V", deviceName: "PSU1", query: "MEAS:VOLT? CH1" },
  y: { label: "Current", unit: "A", deviceName: "PSU1", query: "MEAS:CURR? CH1" },
};

describe("xy chart config", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("returns defaults for missing or foreign configs", () => {
    expect(loadXyChartConfig("xy-missing")).toEqual(DEFAULT_XY_CHART_CONFIG);
    expect(normalizeXyChartConfig({ type: "chart", series: [] })).toEqual(DEFAULT_XY_CHART_CONFIG);
    expect(normalizeXyChartConfig(null)).toEqual(DEFAULT_XY_CHART_CONFIG);
  });

  it("does not share default axis objects between results", () => {
    const first = normalizeXyChartConfig(null);
    first.x.label = "changed";

    expect(normalizeXyChartConfig(null).x.label).toBe("X");
  });

  it("stores and reloads a normalized config", () => {
    saveXyChartConfig("xy-home-main", CONFIGURED);

    expect(loadXyChartConfig("xy-home-main")).toEqual({ type: "xyChart", ...CONFIGURED });
  });

  it("trims, clamps and drops invalid fields", () => {
    const config = normalizeXyChartConfig({
      type: "xyChart",
      cardName: `  ${"n".repeat(80)}  `,
      frequencyHz: 1000,
      pairTimeoutMs: 1,
      historyLimitBytes: 999999999,
      lineColor: "blue",
      x: { label: "", unit: "u".repeat(40), deviceName: "  PSU1 ", query: "  MEAS:VOLT?   CH1 " },
      y: { deviceName: "PSU1", query: "MEAS:CURR" },
    });

    expect(config.cardName).toHaveLength(48);
    expect(config.frequencyHz).toBe(100);
    expect(config.pairTimeoutMs).toBe(MIN_PAIR_TIMEOUT_MS);
    expect(config.historyLimitBytes).toBe(MAX_CHART_HISTORY_BYTES);
    expect(config.lineColor).toBe(DEFAULT_XY_CHART_CONFIG.lineColor);
    expect(config.x).toEqual({ label: "X", unit: "u".repeat(16), deviceName: "PSU1", query: "MEAS:VOLT? CH1" });
    expect(config.y.query).toBe("");
  });

  it("clamps numeric limits and falls back for non-numeric input", () => {
    expect(normalizeXyChartConfig({ type: "xyChart", pairTimeoutMs: 999999 }).pairTimeoutMs).toBe(MAX_PAIR_TIMEOUT_MS);
    expect(normalizeXyChartConfig({ type: "xyChart", historyLimitBytes: 0 }).historyLimitBytes).toBe(1);
    expect(normalizeXyChartConfig({ type: "xyChart", historyLimitBytes: "abc" }).historyLimitBytes).toBe(
      DEFAULT_CHART_HISTORY_LIMIT_BYTES,
    );
    expect(normalizeXyChartConfig({ type: "xyChart", maxPoints: 500 })).not.toHaveProperty("maxPoints");
    expect(normalizeXyChartConfig({ type: "xyChart" }).showLine).toBe(true);
  });

  it("keeps the X·Y line off by default and normalizes its fields", () => {
    expect(normalizeXyChartConfig({ type: "xyChart" }).showProduct).toBe(false);

    const config = normalizeXyChartConfig({
      type: "xyChart",
      showProduct: "yes",
      productColor: "red",
      product: { label: "  ", unit: "w".repeat(40) },
    });

    expect(config.showProduct).toBe(false);
    expect(config.productColor).toBe(DEFAULT_XY_CHART_CONFIG.productColor);
    expect(config.product).toEqual({ label: "X·Y", unit: "w".repeat(16) });
  });

  it("reports whether both axes are configured", () => {
    expect(isXyChartConfigured(DEFAULT_XY_CHART_CONFIG)).toBe(false);
    expect(isXyChartConfigured(normalizeXyChartConfig({ type: "xyChart", ...CONFIGURED }))).toBe(true);
    expect(
      isXyChartConfigured(normalizeXyChartConfig({ type: "xyChart", ...CONFIGURED, y: { deviceName: "PSU1" } })),
    ).toBe(false);
  });

  it("collects an X and a Y subscription per configured widget", () => {
    saveXyChartConfig("xy-home-main", CONFIGURED);

    expect(loadRunnableXySubscriptions()).toEqual([
      { widgetId: "xy-home-main:x", deviceName: "PSU1", query: "MEAS:VOLT? CH1", frequencyHz: 5 },
      { widgetId: "xy-home-main:y", deviceName: "PSU1", query: "MEAS:CURR? CH1", frequencyHz: 5 },
    ]);
  });

  it("collects nothing while either axis is incomplete", () => {
    saveXyChartConfig("xy-home-x-only", { ...CONFIGURED, y: { ...CONFIGURED.y, query: "" } });
    saveXyChartConfig("xy-home-empty", {});

    expect(loadRunnableXySubscriptions()).toEqual([]);
  });
});
