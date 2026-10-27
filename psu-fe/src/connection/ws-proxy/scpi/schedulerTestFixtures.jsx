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
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScpiQueryScheduler } from "./useScpiQueryScheduler.js";

/** Exposes the scheduler facade to integration tests. */
export function Probe({ api, sendWsMessage, wsConnectedRef, deviceState, onScpiError }) {
  api.current = useScpiQueryScheduler({
    sendWsMessage,
    wsConnectedRef,
    getDeviceState: () => deviceState.current,
    onScpiError,
  });

  return null;
}



/** Encodes instrument measurement records for binary-response tests. */
export function measurementDataBlockBase64(records) {
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
  return encodeBase64(bytes);
}

function encodeBase64(bytes) {
  let text = "";
  bytes.forEach((value) => {
    text += String.fromCharCode(value);
  });
  return btoa(text);
}
