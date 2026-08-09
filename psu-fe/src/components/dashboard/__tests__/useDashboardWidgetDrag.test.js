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
import { getVerticalAutoScrollAmount } from "../hooks/useDashboardWidgetDrag.js";

describe("getVerticalAutoScrollAmount", () => {
  it("does not scroll while the pointer is outside the viewport edge zones", () => {
    expect(getVerticalAutoScrollAmount(72, 800)).toBe(0);
    expect(getVerticalAutoScrollAmount(400, 800)).toBe(0);
    expect(getVerticalAutoScrollAmount(728, 800)).toBe(0);
  });

  it("ramps toward a capped speed near the top edge", () => {
    expect(getVerticalAutoScrollAmount(36, 800)).toBe(-5);
    expect(getVerticalAutoScrollAmount(0, 800)).toBe(-10);
    expect(getVerticalAutoScrollAmount(-100, 800)).toBe(-10);
  });

  it("ramps toward a capped speed near the bottom edge", () => {
    expect(getVerticalAutoScrollAmount(764, 800)).toBe(5);
    expect(getVerticalAutoScrollAmount(800, 800)).toBe(10);
    expect(getVerticalAutoScrollAmount(900, 800)).toBe(10);
  });
});
