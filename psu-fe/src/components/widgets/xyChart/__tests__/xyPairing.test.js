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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createXyPairer, DEFAULT_PAIR_TIMEOUT_MS } from "../utils/xyPairing.js";

describe("xyPairing", () => {
  let points;
  let pairer;

  beforeEach(() => {
    vi.useFakeTimers();
    points = [];
    pairer = createXyPairer({ timeoutMs: 1000, onPoint: (point) => points.push(point) });
  });

  afterEach(() => {
    pairer.dispose();
    vi.useRealTimers();
  });

  it("emits one point when both axes are fresh within the timeout", () => {
    pairer.update("x", { value: 1.5, t: 100 });
    vi.advanceTimersByTime(400);
    pairer.update("y", { value: 0.2, t: 500 });

    expect(points).toEqual([{ x: 1.5, y: 0.2, t: 500, carried: null }]);

    vi.advanceTimersByTime(5000);
    expect(points).toHaveLength(1);
  });

  it("does not depend on which axis updates first", () => {
    pairer.update("y", { value: 0.2, t: 100 });
    pairer.update("x", { value: 1.5, t: 200 });

    expect(points).toEqual([{ x: 1.5, y: 0.2, t: 200, carried: null }]);
  });

  it("uses the latest known value of the other axis on timeout", () => {
    pairer.seed("y", { value: 0.2, t: 50 });
    pairer.update("x", { value: 1.5, t: 100 });

    vi.advanceTimersByTime(999);
    expect(points).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(points).toEqual([{ x: 1.5, y: 0.2, t: 100, carried: "y" }]);
  });

  it("carries the previous pair value forward after an earlier point", () => {
    pairer.update("x", { value: 1, t: 100 });
    pairer.update("y", { value: 10, t: 110 });
    pairer.update("x", { value: 2, t: 1100 });

    vi.advanceTimersByTime(1000);

    expect(points).toEqual([
      { x: 1, y: 10, t: 110, carried: null },
      { x: 2, y: 10, t: 1100, carried: "y" },
    ]);
  });

  it("emits nothing on timeout when the other axis never reported", () => {
    pairer.update("x", { value: 1.5, t: 100 });

    vi.advanceTimersByTime(2000);

    expect(points).toEqual([]);
  });

  it("overwrites a pending value without restarting the timer", () => {
    pairer.seed("y", { value: 0.2, t: 50 });
    pairer.update("x", { value: 1, t: 100 });
    vi.advanceTimersByTime(600);
    pairer.update("x", { value: 2, t: 700 });

    vi.advanceTimersByTime(400);

    expect(points).toEqual([{ x: 2, y: 0.2, t: 700, carried: "y" }]);
  });

  it("does not emit or start a timer when seeded", () => {
    pairer.seed("x", { value: 1, t: 100 });
    pairer.seed("y", { value: 2, t: 100 });

    vi.advanceTimersByTime(5000);

    expect(points).toEqual([]);
  });

  it("starts a new wait after a timed-out point", () => {
    pairer.seed("y", { value: 0.2, t: 50 });
    pairer.update("x", { value: 1, t: 100 });
    vi.advanceTimersByTime(1000);
    pairer.update("x", { value: 2, t: 1200 });
    vi.advanceTimersByTime(1000);

    expect(points.map((point) => point.x)).toEqual([1, 2]);
  });

  it("ignores invalid samples and unknown axes", () => {
    pairer.seed("y", { value: 0.2, t: 50 });
    pairer.update("x", { value: Number.NaN, t: 100 });
    pairer.update("x", { value: 1, t: Number.NaN });
    pairer.update("x", null);
    pairer.update("z", { value: 1, t: 100 });

    vi.advanceTimersByTime(5000);

    expect(points).toEqual([]);
  });

  it("cancels a pending wait and forgets values on reset", () => {
    pairer.seed("y", { value: 0.2, t: 50 });
    pairer.update("x", { value: 1, t: 100 });
    pairer.reset();

    vi.advanceTimersByTime(5000);
    expect(points).toEqual([]);

    pairer.update("x", { value: 2, t: 6000 });
    vi.advanceTimersByTime(5000);
    expect(points).toEqual([]);
  });

  it("stops emitting after dispose", () => {
    pairer.seed("y", { value: 0.2, t: 50 });
    pairer.update("x", { value: 1, t: 100 });
    pairer.dispose();
    pairer.update("y", { value: 3, t: 200 });

    vi.advanceTimersByTime(5000);

    expect(points).toEqual([]);
  });

  it("falls back to the default timeout for an invalid value", () => {
    const fallbackPoints = [];
    const fallback = createXyPairer({ timeoutMs: "abc", onPoint: (point) => fallbackPoints.push(point) });
    fallback.seed("y", { value: 0.2, t: 50 });
    fallback.update("x", { value: 1, t: 100 });

    vi.advanceTimersByTime(DEFAULT_PAIR_TIMEOUT_MS - 1);
    expect(fallbackPoints).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(fallbackPoints).toHaveLength(1);
    fallback.dispose();
  });
});
