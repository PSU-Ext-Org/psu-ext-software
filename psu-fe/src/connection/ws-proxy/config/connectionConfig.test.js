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
import { beforeEach, describe, expect, it } from "vitest";
import {
  CONFIG_KEY,
  clearConfigStorage,
  EMPTY_CONFIG,
  hasTcpConfig,
  hasWsConfig,
  loadConfig,
  normalisePath,
  saveConfigToStorage,
} from "./connectionConfig.js";

describe("connectionConfig", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loads defaults when storage is empty", () => {
    expect(loadConfig()).toEqual(EMPTY_CONFIG);
  });

  it("merges saved config with defaults for new fields", () => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ wsHost: "localhost" }));

    expect(loadConfig()).toMatchObject({
      ...EMPTY_CONFIG,
      wsHost: "localhost",
    });
  });

  it("falls back to defaults for malformed saved config", () => {
    localStorage.setItem(CONFIG_KEY, "{nope");

    expect(loadConfig()).toEqual(EMPTY_CONFIG);
  });

  it("persists config to localStorage", () => {
    const config = {
      ...EMPTY_CONFIG,
      autoConnect: true,
      deviceAutoConnectIds: ["0"],
      wsHost: "proxy.local",
    };

    saveConfigToStorage(config);

    expect(JSON.parse(localStorage.getItem(CONFIG_KEY))).toMatchObject(config);
  });

  it("clears persisted config from localStorage", () => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ wsHost: "localhost" }));

    clearConfigStorage();

    expect(localStorage.getItem(CONFIG_KEY)).toBeNull();
  });

  it("normalises saved device auto-connect ids", () => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ deviceAutoConnectIds: [0, "1"] }));

    expect(loadConfig().deviceAutoConnectIds).toEqual(["0", "1"]);
  });

  it("detects complete websocket config", () => {
    expect(
      hasWsConfig({ ...EMPTY_CONFIG, wsHost: "localhost", wsPort: "8080", wsPath: "/ws/scpi" }),
    ).toBe(true);
    expect(hasWsConfig({ ...EMPTY_CONFIG, wsHost: "localhost", wsPort: "8080" })).toBe(false);
  });

  it("detects complete tcp config only for tcp mode", () => {
    expect(hasTcpConfig({ ...EMPTY_CONFIG, tcpHost: "192.168.4.1", tcpPort: "5025" })).toBe(true);
    expect(
      hasTcpConfig({
        ...EMPTY_CONFIG,
        deviceMode: "usb",
        tcpHost: "192.168.4.1",
        tcpPort: "5025",
      }),
    ).toBe(false);
  });

  it("normalises websocket paths", () => {
    expect(normalisePath("ws/scpi")).toBe("/ws/scpi");
    expect(normalisePath("/ws/scpi")).toBe("/ws/scpi");
    expect(normalisePath("")).toBe("");
  });

});
