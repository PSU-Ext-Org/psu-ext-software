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
import { Probe, measurementDataBlockBase64 } from "./schedulerTestFixtures.jsx";

describe("SCPI scheduler subscriptions", () => {
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
it.each(["device", "proxy"])("discards stale requests and readings after %s disconnect", (target) => {
    render(<Probe api={api} deviceState={deviceState} sendWsMessage={sendWsMessage}
      wsConnectedRef={wsConnectedRef} />);
    act(() => {
      api.current.subscribeScpiQuery({ widgetId: "voltage", deviceName: "PSU1",
        query: "MEAS:VOLT?", frequencyHz: 1 });
      if (target === "device") deviceState.current.deviceStatuses[0].state = "DISCONNECTED";
      else wsConnectedRef.current = false;
      api.current.pollScpiQueries();
    });
    expect(api.current.getScpiQuerySnapshot("PSU1", "MEAS:VOLT?")).toMatchObject({
      value: "", loading: false, updatedAt: 0, disconnected: true,
    });
    act(() => {
      deviceState.current.deviceStatuses[0].state = "CONNECTED";
      wsConnectedRef.current = true;
      api.current.pollScpiQueries();
      expect(api.current.handleScpiSchedulerMessage({ uuid: "uuid-1", payload: "99" })).toBe(false);
      api.current.handleScpiSchedulerMessage({ uuid: "uuid-2", payload: "12" });
    });
    expect(sendWsMessage).toHaveBeenCalledTimes(2);
    expect(api.current.getScpiQuerySnapshot("PSU1", "MEAS:VOLT?").value).toBe("12");
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
