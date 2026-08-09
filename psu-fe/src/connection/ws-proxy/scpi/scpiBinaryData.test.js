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
import { parseScpiMeasurementDataBlock } from "./scpiBinaryData.js";

describe("parseScpiMeasurementDataBlock", () => {
  it("parses PSU measurement DATA records into Unix-millisecond chart points", () => {
    const block = measurementDataBlock([
      { timeMs: 1000, valueU4: 120400 },
      { timeMs: 1100, valueU4: 122400 },
    ]);

    expect(parseScpiMeasurementDataBlock(block, 5000)).toEqual([
      { t: 4900, y: 12.04, sourceT: 1000 },
      { t: 5000, y: 12.24, sourceT: 1100 },
    ]);
  });

  it("rejects invalid definite-length blocks", () => {
    expect(parseScpiMeasurementDataBlock(new Uint8Array([0x31, 0x32]), 5000)).toEqual([]);
  });
});

function measurementDataBlock(records) {
  const payloadLength = records.length * 8;
  const header = new TextEncoder().encode(`#${String(payloadLength).length}${payloadLength}`);
  const bytes = new Uint8Array(header.length + payloadLength);
  bytes.set(header);
  const view = new DataView(bytes.buffer, header.length);
  records.forEach((record, index) => {
    const offset = index * 8;
    view.setUint32(offset, record.timeMs, true);
    view.setUint32(offset + 4, record.valueU4, true);
  });
  return bytes;
}
