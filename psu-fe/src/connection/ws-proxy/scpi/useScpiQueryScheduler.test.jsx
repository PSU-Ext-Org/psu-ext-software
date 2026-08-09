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

function Probe({ api, sendWsMessage, wsConnectedRef, deviceState }) {
  api.current = useScpiQueryScheduler({
    sendWsMessage,
    wsConnectedRef,
    getDeviceState: () => deviceState.current,
  });

  return null;
}

describe("useScpiQueryScheduler", () => {
  let api;
  let deviceState;
  let sendWsMessage;
  let wsConnectedRef;
  let nextRequestId;

  beforeEach(() => {
    vi.useFakeTimers();
    api = { current: null };
    deviceState = {
      current: {
        devices: [{ id: "0", name: "PSU1" }],
        deviceStatuses: { 0: { state: "CONNECTED" } },
      },
    };
    wsConnectedRef = { current: true };
    nextRequestId = 0;
    sendWsMessage = vi.fn(() => `uuid-${(nextRequestId += 1)}`);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shares one in-flight request for duplicate device/query subscriptions", () => {
    render(
      <Probe
        api={api}
        deviceState={deviceState}
        sendWsMessage={sendWsMessage}
        wsConnectedRef={wsConnectedRef}
      />,
    );

    act(() => {
      api.current.subscribeScpiQuery({
        widgetId: "voltage-a",
        deviceName: "PSU1",
        query: "MEAS:VOLT? CH1",
        frequencyHz: 1,
      });
      api.current.subscribeScpiQuery({
        widgetId: "voltage-b",
        deviceName: "PSU1",
        query: "MEAS:VOLT?   CH1",
        frequencyHz: 2,
      });
    });

    expect(sendWsMessage).toHaveBeenCalledTimes(1);
    expect(sendWsMessage).toHaveBeenCalledWith("CMD PSU1 MEAS:VOLT? CH1", "SCHEDULER");
  });

  it("uses the fastest requested frequency for shared polling", () => {
    render(
      <Probe
        api={api}
        deviceState={deviceState}
        sendWsMessage={sendWsMessage}
        wsConnectedRef={wsConnectedRef}
      />,
    );

    act(() => {
      api.current.subscribeScpiQuery({
        widgetId: "slow",
        deviceName: "PSU1",
        query: "MEAS:VOLT?",
        frequencyHz: 1,
      });
      api.current.handleScpiSchedulerMessage({ uuid: "uuid-1", payload: "12.0" });
      api.current.subscribeScpiQuery({
        widgetId: "fast",
        deviceName: "PSU1",
        query: "MEAS:VOLT?",
        frequencyHz: 10,
      });
      api.current.handleScpiSchedulerMessage({ uuid: "uuid-2", payload: "12.1" });
    });

    sendWsMessage.mockClear();

    act(() => {
      vi.advanceTimersByTime(99);
    });
    expect(sendWsMessage).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(sendWsMessage).toHaveBeenCalledWith("CMD PSU1 MEAS:VOLT?", "SCHEDULER");
  });

  it("updates cache snapshots from scheduler responses and stores errors", () => {
    render(
      <Probe
        api={api}
        deviceState={deviceState}
        sendWsMessage={sendWsMessage}
        wsConnectedRef={wsConnectedRef}
      />,
    );

    act(() => {
      api.current.subscribeScpiQuery({
        widgetId: "voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT?",
        frequencyHz: 1,
      });
      api.current.handleScpiSchedulerMessage({ uuid: "uuid-1", payload: "12.04" });
    });

    expect(api.current.getScpiQuerySnapshot("PSU1", "MEAS:VOLT?")).toMatchObject({
      value: "12.04",
      loading: false,
      error: "",
    });

    act(() => {
      vi.advanceTimersByTime(1000);
      api.current.handleScpiSchedulerMessage({ uuid: "uuid-2", payload: "ERR TIMEOUT No response" });
    });

    expect(api.current.getScpiQuerySnapshot("PSU1", "MEAS:VOLT?")).toMatchObject({
      value: "12.04",
      loading: false,
      error: "ERR TIMEOUT No response",
    });
  });

  it("updates cache snapshots from binary DATA responses", () => {
    vi.setSystemTime(5000);
    render(
      <Probe
        api={api}
        deviceState={deviceState}
        sendWsMessage={sendWsMessage}
        wsConnectedRef={wsConnectedRef}
      />,
    );

    act(() => {
      api.current.subscribeScpiQuery({
        widgetId: "voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT:DATA? CH1",
        frequencyHz: 1,
      });
      api.current.handleScpiSchedulerBinaryMessage({
        uuid: "uuid-1",
        payload: measurementDataBlockBase64([
          { timeMs: 1000, valueU4: 120400 },
          { timeMs: 1100, valueU4: 122400 },
        ]),
      });
    });

    expect(api.current.getScpiQuerySnapshot("PSU1", "MEAS:VOLT:DATA? CH1")).toMatchObject({
      value: "12.24",
      points: [
        { t: 4900, y: 12.04, sourceT: 1000 },
        { t: 5000, y: 12.24, sourceT: 1100 },
      ],
      loading: false,
      error: "",
    });
  });

  it("notifies only listeners for the changed snapshot identity", () => {
    render(
      <Probe
        api={api}
        deviceState={deviceState}
        sendWsMessage={sendWsMessage}
        wsConnectedRef={wsConnectedRef}
      />,
    );

    const voltageListener = vi.fn();
    const currentListener = vi.fn();

    act(() => {
      api.current.subscribeScpiSnapshot("PSU1", "MEAS:VOLT?", voltageListener);
      api.current.subscribeScpiSnapshot("PSU1", "MEAS:CURR?", currentListener);
      api.current.subscribeScpiQuery({
        widgetId: "voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT?",
        frequencyHz: 1,
      });
    });

    voltageListener.mockClear();
    currentListener.mockClear();

    act(() => {
      api.current.handleScpiSchedulerMessage({ uuid: "uuid-1", payload: "12.04" });
    });

    expect(voltageListener).toHaveBeenCalledTimes(1);
    expect(currentListener).not.toHaveBeenCalled();
  });

  it("clears polling intervals when the last subscriber is removed", () => {
    render(
      <Probe
        api={api}
        deviceState={deviceState}
        sendWsMessage={sendWsMessage}
        wsConnectedRef={wsConnectedRef}
      />,
    );

    let unsubscribe;
    act(() => {
      unsubscribe = api.current.subscribeScpiQuery({
        widgetId: "voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT?",
        frequencyHz: 10,
      });
      api.current.handleScpiSchedulerMessage({ uuid: "uuid-1", payload: "12.0" });
    });

    sendWsMessage.mockClear();

    act(() => {
      unsubscribe();
      vi.advanceTimersByTime(500);
    });

    expect(sendWsMessage).not.toHaveBeenCalled();
    expect(api.current.getScpiQuerySnapshot("PSU1", "MEAS:VOLT?")).toMatchObject({
      value: "",
      updatedAt: 0,
      loading: false,
      error: "",
    });
  });

  it("keeps shared polling active until the final subscriber leaves", () => {
    render(
      <Probe
        api={api}
        deviceState={deviceState}
        sendWsMessage={sendWsMessage}
        wsConnectedRef={wsConnectedRef}
      />,
    );

    let unsubscribeSlow;
    let unsubscribeFast;
    act(() => {
      unsubscribeSlow = api.current.subscribeScpiQuery({
        widgetId: "slow",
        deviceName: "PSU1",
        query: "MEAS:VOLT?",
        frequencyHz: 1,
      });
      api.current.handleScpiSchedulerMessage({ uuid: "uuid-1", payload: "12.0" });
      unsubscribeFast = api.current.subscribeScpiQuery({
        widgetId: "fast",
        deviceName: "PSU1",
        query: "MEAS:VOLT?",
        frequencyHz: 10,
      });
      api.current.handleScpiSchedulerMessage({ uuid: "uuid-2", payload: "12.1" });
    });

    sendWsMessage.mockClear();

    act(() => {
      unsubscribeFast();
    });
    expect(sendWsMessage).toHaveBeenCalledWith("CMD PSU1 MEAS:VOLT?", "SCHEDULER");
    act(() => {
      api.current.handleScpiSchedulerMessage({ uuid: "uuid-3", payload: "12.2" });
    });
    sendWsMessage.mockClear();

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(sendWsMessage).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(sendWsMessage).toHaveBeenCalledWith("CMD PSU1 MEAS:VOLT?", "SCHEDULER");

    sendWsMessage.mockClear();

    act(() => {
      unsubscribeSlow();
      vi.advanceTimersByTime(1000);
    });
    expect(sendWsMessage).not.toHaveBeenCalled();
  });
});

function measurementDataBlockBase64(records) {
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
