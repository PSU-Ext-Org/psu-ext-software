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
/**
 * Parses one UUID-tagged WebSocket response frame.
 *
 * @param {unknown} message - Raw WebSocket message payload.
 * @returns {{type: "RES" | "BIN", uuid: string, payload: string} | null}
 */
export function parseWsEnvelope(message) {
  const text = String(message || "");
  const firstSeparator = text.indexOf(" ");
  if (firstSeparator < 0) {
    return null;
  }

  const type = text.substring(0, firstSeparator);
  if (type !== "RES" && type !== "BIN") {
    return null;
  }

  const remainder = text.substring(firstSeparator + 1);
  const secondSeparator = remainder.indexOf(" ");
  if (secondSeparator < 0) {
    return null;
  }

  const uuid = remainder.substring(0, secondSeparator).trim();
  const payload = remainder.substring(secondSeparator + 1);
  if (!uuid || !payload.trim()) {
    return null;
  }

  return { type, uuid, payload };
}

/**
 * Builds one UUID-tagged WebSocket request frame.
 *
 * @param {string} uuid - Request UUID.
 * @param {string} payload - Inner command payload.
 * @returns {string}
 */
export function formatWsRequest(uuid, payload) {
  return `REQ ${uuid} ${payload}`;
}

/**
 * Generates one request UUID.
 *
 * @returns {string}
 */
export function createRequestUuid() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const now = Date.now().toString(16);
  const random = Math.random().toString(16).slice(2, 14).padEnd(12, "0");
  return `${now.slice(-8)}-${random.slice(0, 4)}-${random.slice(4, 8)}-${random.slice(8, 12)}-${random.slice(0, 12)}`;
}

/**
 * Decodes one base64-encoded binary WebSocket payload into bytes.
 *
 * @param {string} value - Base64 payload text.
 * @returns {Uint8Array}
 */
export function decodeBase64Payload(value) {
  const base64 = String(value || "").trim();
  if (!base64) {
    return new Uint8Array();
  }

  if (typeof atob === "function") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  return Uint8Array.from(Buffer.from(base64, "base64"));
}
