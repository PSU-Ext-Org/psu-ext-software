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

describe("SCPI scheduler responses", () => {
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

  it("refreshes immediately, ignores superseded replies and continues polling", () => {
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
    });

    // The refresh must send now, even though uuid-1 still owns a pending poll.
    act(() => {
      expect(api.current.refreshScpiQuery("PSU1", "MEAS:VOLT?")).toBe(true);
      expect(api.current.handleScpiSchedulerMessage({
        uuid: "uuid-1",
        payload: "99",
      })).toBe(false);

      api.current.handleScpiSchedulerMessage({ uuid: "uuid-2", payload: "12" });

      // A superseded reply must also be ignored if it arrives after the fresh one.
      expect(api.current.handleScpiSchedulerMessage({
        uuid: "uuid-1",
        payload: "99",
      })).toBe(false);
    });

    expect(api.current.getScpiQuerySnapshot("PSU1", "MEAS:VOLT?").value).toBe("12");
    expect(sendWsMessage).toHaveBeenCalledTimes(2);

    act(() => vi.advanceTimersByTime(1000));

    expect(sendWsMessage).toHaveBeenCalledTimes(3);
  });

  it("reports refresh timeout and send failure without replacing the previous value", () => {
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
        frequencyHz: 0.1,
      });
      api.current.handleScpiSchedulerMessage({ uuid: "uuid-1", payload: "12" });
    });

    // Leave the explicit refresh unanswered to exercise its bounded wait.
    act(() => {
      api.current.refreshScpiQuery("PSU1", "MEAS:VOLT?");
      vi.advanceTimersByTime(10000);
    });

    expect(api.current.getScpiQuerySnapshot("PSU1", "MEAS:VOLT?")).toMatchObject({
      value: "12",
      error: "SCPI refresh timed out.",
      loading: false,
    });

    act(() => {
      sendWsMessage.mockReturnValue(null);
      expect(api.current.refreshScpiQuery("PSU1", "MEAS:VOLT?")).toBe(false);
    });

    expect(api.current.getScpiQuerySnapshot("PSU1", "MEAS:VOLT?").error)
      .toBe("SCPI query could not be sent.");
  });

  it.each(["device", "proxy"])("discards stale requests and readings after %s disconnect", (target) => {
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

      if (target === "device") {
        deviceState.current.deviceStatuses[0].state = "DISCONNECTED";
      } else {
        wsConnectedRef.current = false;
      }

      api.current.pollScpiQueries();
    });

    expect(api.current.getScpiQuerySnapshot("PSU1", "MEAS:VOLT?")).toMatchObject({
      value: "",
      loading: false,
      updatedAt: 0,
      disconnected: true,
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

  it("reports scheduler errors for the target device without triggering on successful or unrelated responses", () => {
    const onScpiError = vi.fn();

    render(
      <Probe
        api={api}
        deviceState={deviceState}
        sendWsMessage={sendWsMessage}
        wsConnectedRef={wsConnectedRef}
        onScpiError={onScpiError}
      />,
    );

    act(() => {
      api.current.subscribeScpiQuery({
        widgetId: "voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT?",
        frequencyHz: 1,
      });
      api.current.handleScpiSchedulerMessage({ uuid: "uuid-1", payload: "12" });
      api.current.handleScpiSchedulerMessage({ uuid: "unrelated", payload: "ERR DISCONNECTED" });
    });

    expect(onScpiError).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
      api.current.handleScpiSchedulerMessage({ uuid: "uuid-2", payload: "ERR CONNECTION_LOST USB removed" });
    });

    expect(onScpiError).toHaveBeenCalledExactlyOnceWith("PSU1", "ERR CONNECTION_LOST USB removed");
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
});
