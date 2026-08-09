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
const DATA_RECORD_SIZE = 8;
const FIXED_POINT_SCALE_U4 = 10_000;

/**
 * Parses PSU-EXT measurement DATA? SCPI definite-length binary blocks.
 *
 * Payload records are little-endian pairs:
 * - uint32 device sample time in milliseconds
 * - uint32 fixed-point value scaled by 10,000
 *
 * @param {ArrayBuffer | Uint8Array} input
 * @param {number} receivedAt
 * @returns {Array<{t: number, y: number, sourceT: number}>}
 */
export function parseScpiMeasurementDataBlock(input, receivedAt = Date.now()) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const payloadOffset = readDefiniteBlockPayloadOffset(bytes);
  if (payloadOffset < 0) {
    return [];
  }

  const payloadLength = readDefiniteBlockPayloadLength(bytes, payloadOffset);
  if (payloadLength < 0 || payloadOffset + payloadLength > bytes.length) {
    return [];
  }

  const recordCount = Math.floor(payloadLength / DATA_RECORD_SIZE);
  if (!recordCount) {
    return [];
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset + payloadOffset, recordCount * DATA_RECORD_SIZE);
  const records = [];
  for (let index = 0; index < recordCount; index += 1) {
    const offset = index * DATA_RECORD_SIZE;
    const sampleTimeMs = view.getUint32(offset, true);
    const valueU4 = view.getUint32(offset + 4, true);
    records.push({
      sourceT: sampleTimeMs,
      y: valueU4 / FIXED_POINT_SCALE_U4,
    });
  }

  const latestSourceT = records.at(-1)?.sourceT;
  if (!Number.isFinite(latestSourceT)) {
    return [];
  }

  const wallClockOffsetMs = receivedAt - latestSourceT;
  return records.map((record) => ({
    ...record,
    t: wallClockOffsetMs + record.sourceT,
  }));
}

function readDefiniteBlockPayloadOffset(bytes) {
  if (bytes.length < 2 || bytes[0] !== 0x23) {
    return -1;
  }

  const digitCount = bytes[1] - 0x30;
  if (digitCount < 1 || digitCount > 9 || bytes.length < 2 + digitCount) {
    return -1;
  }

  return 2 + digitCount;
}

function readDefiniteBlockPayloadLength(bytes, payloadOffset) {
  const digitStart = 2;
  let payloadLength = 0;
  for (let index = digitStart; index < payloadOffset; index += 1) {
    const digit = bytes[index] - 0x30;
    if (digit < 0 || digit > 9) {
      return -1;
    }

    payloadLength = payloadLength * 10 + digit;
  }

  return payloadLength;
}
