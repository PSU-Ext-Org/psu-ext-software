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
export const DEVICE_IDENTITY_MAX_CHARS = 512;

export const EMPTY_DEVICE_IDENTITY = {
  manufacturer: "",
  model: "",
  serialNumber: "",
  firmwareLevel: "",
  name: "",
  raw: "",
  valid: false,
  error: null,
};

/**
 * Detects transport/status messages that are not `*IDN?` responses.
 *
 * @param {string} message - Raw inbound WebSocket message.
 * @returns {boolean}
 */
export function isConnectionLifecycleMessage(message) {
  return (
    message.startsWith("STATUS ") ||
    message.startsWith("OK CONNECTED") ||
    message.startsWith("OK DISCONNECTED") ||
    message.startsWith("ERR DISCONNECTED")
  );
}

/**
 * Parses a SCPI `*IDN?` response defensively.
 *
 * Expected format is `<Manufacturer>,<Model>,<Serial Number>,<Firmware Level>`.
 * The raw value is retained even when malformed.
 *
 * @param {string} message - Raw `*IDN?` response.
 * @returns {typeof EMPTY_DEVICE_IDENTITY}
 */
export function parseDeviceIdentity(message) {
  const raw = cleanDeviceIdentityText(message);
  const parts = raw.split(",").map((part) => cleanDeviceIdentityText(part));
  const [manufacturer = "", model = "", serialNumber = "", ...firmwareParts] = parts;
  const firmwareLevel = firmwareParts.join(",").trim();
  const valid = Boolean(manufacturer && model && serialNumber && firmwareLevel && parts.length >= 4);
  const name = valid ? `${manufacturer} ${model}` : "";

  return {
    manufacturer,
    model,
    serialNumber,
    firmwareLevel,
    name,
    raw,
    valid,
    error: valid ? null : "Malformed device identity response",
  };
}

/**
 * Removes control characters, collapses whitespace, and caps untrusted identity text.
 *
 * @param {unknown} value - Untrusted device-provided value.
 * @returns {string}
 */
export function cleanDeviceIdentityText(value) {
  return String(value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, DEVICE_IDENTITY_MAX_CHARS);
}
