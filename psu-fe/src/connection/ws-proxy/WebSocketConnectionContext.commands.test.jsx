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
import { act, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  renderProvider,
  connection,
  latestSocket,
  updateConfig,
  DEVICE_LIST,
  WIDGET_CONFIG_STORAGE_KEY,
  sentPayloads,
  parseRequestPayload,
  requestUuid,
  receivePayload,
  receiveWithRequestIndex,
  setupConnectionTests,
} from "./connectionTestFixtures.jsx";

setupConnectionTests();

describe("WebSocket connection commands", () => {
  it("sends SCPI commands through explicit device targeting", async () => {
    renderProvider();
    await updateConfig({ wsHost: "localhost", wsPort: "8080", wsPath: "/ws/scpi" });

    await act(async () => {
      connection().sendScpiCommand("MEAS:VOLT?", "PSU1");
    });

    expect(screen.getByTestId("messages")).toHaveTextContent(
      "Cannot send SCPI command without a connected target",
    );

    await act(async () => {
      connection().connectWs();
      latestSocket().open();
      receivePayload(latestSocket(), DEVICE_LIST);
      receivePayload(latestSocket(), "OK STATUS");
      latestSocket().sent = [];
      connection().sendScpiCommand("MEAS:VOLT?", "PSU1");
    });

    expect(sentPayloads(latestSocket())).toEqual(["CMD PSU1 MEAS:VOLT?"]);
    expect(screen.getByTestId("messages")).toHaveTextContent(
      /\[USER\] OUT \[[^\]]+\] CMD PSU1 MEAS:VOLT\?/,
    );
  });

  it("can await SCPI command responses through the monitor command path", async () => {
    renderProvider();
    await updateConfig({ wsHost: "localhost", wsPort: "8080", wsPath: "/ws/scpi" });

    await act(async () => {
      connection().connectWs();
      latestSocket().open();
      receivePayload(latestSocket(), DEVICE_LIST);
      receivePayload(latestSocket(), "OK STATUS");
      latestSocket().sent = [];
    });

    let commandPromise;
    await act(async () => {
      commandPromise = connection().sendScpiCommand("OUTP? CH1", "PSU1", {
        waitForResponse: true,
      });
    });

    expect(sentPayloads(latestSocket())).toEqual(["CMD PSU1 OUTP? CH1"]);
    expect(screen.getByTestId("messages")).toHaveTextContent(
      /\[USER\] OUT \[[^\]]+\] CMD PSU1 OUTP\? CH1/,
    );

    await act(async () => {
      receiveWithRequestIndex(latestSocket(), 1, "1");
    });

    await expect(commandPromise).resolves.toEqual({ ok: true, response: "1", type: "RES" });
    expect(connection().getScpiQuerySnapshot("PSU1", "OUTP? CH1").value).toBe("");
  });

  it("can await binary SCPI command responses without timing out", async () => {
    renderProvider();
    await updateConfig({ wsHost: "localhost", wsPort: "8080", wsPath: "/ws/scpi" });

    await act(async () => {
      connection().connectWs();
      latestSocket().open();
      receivePayload(latestSocket(), DEVICE_LIST);
      receivePayload(latestSocket(), "STATUS id=0 name=PSU1 state=CONNECTED transport=tcp");
      latestSocket().sent = [];
    });

    let commandPromise;
    await act(async () => {
      commandPromise = connection().sendScpiCommand("MEAS:VOLT:DATA? CH1", "PSU1", {
        waitForResponse: true,
      });
    });

    expect(sentPayloads(latestSocket())).toEqual(["CMD PSU1 MEAS:VOLT:DATA? CH1"]);

    await act(async () => {
      receiveWithRequestIndex(latestSocket(), 1, "IzE0AQIDBA==", "BIN");
    });

    await expect(commandPromise).resolves.toEqual({
      ok: true,
      response: "IzE0AQIDBA==",
      type: "BIN",
    });
  });

  it("rejects awaited SCPI command promises for error responses", async () => {
    renderProvider();
    await updateConfig({ wsHost: "localhost", wsPort: "8080", wsPath: "/ws/scpi" });

    await act(async () => {
      connection().connectWs();
      latestSocket().open();
      receivePayload(latestSocket(), DEVICE_LIST);
      receivePayload(latestSocket(), "OK STATUS");
    });

    let commandErrorPromise;
    await act(async () => {
      const commandPromise = connection().sendScpiCommand("OUTP? CH1", "PSU1", {
        waitForResponse: true,
      });
      commandErrorPromise = commandPromise.catch((error) => error);
      receiveWithRequestIndex(latestSocket(), 3, "ERR TIMEOUT No response");
    });

    await expect(commandErrorPromise).resolves.toEqual(expect.any(Error));
    await expect(commandErrorPromise).resolves.toMatchObject({
      message: "ERR TIMEOUT No response",
    });
  });
});
