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
import { createMonitorTagQueue, MONITOR_TAG } from "./monitorTagQueue.js";

describe("monitorTagQueue", () => {
  it("consumes tracked tags by UUID", () => {
    const queue = createMonitorTagQueue();

    queue.track("uuid-1", MONITOR_TAG.USER);
    queue.track("uuid-2", MONITOR_TAG.SYSTEM);

    expect(queue.consume("uuid-1")).toBe(MONITOR_TAG.USER);
    expect(queue.consume("uuid-2")).toBe(MONITOR_TAG.SYSTEM);
  });

  it("defaults to system when no tag is pending", () => {
    const queue = createMonitorTagQueue();

    expect(queue.consume("missing")).toBe(MONITOR_TAG.SYSTEM);
  });

  it("clears pending tags", () => {
    const queue = createMonitorTagQueue();

    queue.track("uuid-1", MONITOR_TAG.USER);
    queue.clear();

    expect(queue.consume("uuid-1")).toBe(MONITOR_TAG.SYSTEM);
  });
});
