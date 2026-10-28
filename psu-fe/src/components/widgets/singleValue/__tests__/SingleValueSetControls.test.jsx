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
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SingleValueSetControls } from "../components/SingleValueSetControls.jsx";
import { MONITOR_TAG } from "../../../../connection/ws-proxy/monitor/monitorTagQueue.js";

const WRITE_CONFIG = {
  deviceName: "PSU1",
  query: "MEAS:CURR? CH1",
  setValueCommand: "MEAS:CURR:REL CH1, {value}",
  defaultValue: "0",
};

/**
 * Renders connected controls with successful transport defaults.
 * Tests override only the connection state or failure path they exercise.
 *
 * @param {object} [overrides] - Props replacing the shared fixture defaults.
 * @returns {ReturnType<typeof render> & {props: object}} Render controls and transport spies.
 */
function setup(overrides = {}) {
  const props = {
    config: WRITE_CONFIG,
    connected: true,
    snapshot: { loading: false, error: "" },
    sendScpiCommand: vi.fn().mockResolvedValue({ ok: true }),
    refreshScpiQuery: vi.fn(() => true),
    ...overrides,
  };
  const view = render(<SingleValueSetControls {...props} />);

  return { ...view, props };
}

/**
 * Leaves a write pending so the test controls when the device acknowledges it.
 *
 * @returns {{promise: Promise<object>, acknowledge: () => void}}
 */
function createPendingWrite() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });

  return {
    promise,
    acknowledge: () => resolve({ ok: true }),
  };
}

afterEach(cleanup);

describe("single value write controls", () => {
  it.each(["-1.2e-3", "OFF", "$&"])(
    "sends literal trimmed input %s and refreshes only after success",
    async (value) => {
      const pendingWrite = createPendingWrite();
      const { props } = setup({
        sendScpiCommand: vi.fn(() => pendingWrite.promise),
      });
      const input = screen.getByLabelText("Set value");
      const setButton = screen.getByRole("button", { name: "Set", exact: true });

      expect(input).toHaveValue("");
      expect(setButton).toBeDisabled();

      fireEvent.change(input, { target: { value: ` ${value} ` } });
      fireEvent.click(setButton);

      expect(props.sendScpiCommand).toHaveBeenCalledExactlyOnceWith(
        `MEAS:CURR:REL CH1, ${value}`,
        "PSU1",
        { tag: MONITOR_TAG.GUI, waitForResponse: true },
      );
      expect(props.refreshScpiQuery).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Default" })).toBeDisabled();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();

      // An accepted write, rather than the click itself, triggers measurement refresh.
      await act(async () => pendingWrite.acknowledge());

      expect(props.refreshScpiQuery).toHaveBeenCalledExactlyOnceWith("PSU1", "MEAS:CURR? CH1");
      expect(input).toHaveValue(` ${value} `);
    },
  );

  it.each(["Set", "Default"])(
    "keeps %s silent and both buttons disabled until its refresh completes",
    async (action) => {
      const pendingWrite = createPendingWrite();
      const { props, rerender } = setup({
        sendScpiCommand: vi.fn(() => pendingWrite.promise),
      });
      const setButton = screen.getByRole("button", { name: "Set", exact: true });
      const defaultButton = screen.getByRole("button", { name: "Default" });

      fireEvent.change(screen.getByLabelText("Set value"), { target: { value: "1" } });
      fireEvent.click(action === "Set" ? setButton : defaultButton);

      expect(setButton).toBeDisabled();
      expect(defaultButton).toBeDisabled();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();

      // The scheduler marks the immediate measurement query as pending.
      rerender(
        <SingleValueSetControls {...props} snapshot={{ loading: true, error: "" }} />,
      );
      await act(async () => pendingWrite.acknowledge());

      expect(setButton).toBeDisabled();
      expect(defaultButton).toBeDisabled();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();

      rerender(
        <SingleValueSetControls {...props} snapshot={{ loading: false, error: "" }} />,
      );

      expect(setButton).toBeEnabled();
      expect(defaultButton).toBeEnabled();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();

      // Ordinary background polling is independent of the completed write action.
      rerender(
        <SingleValueSetControls {...props} snapshot={{ loading: true, error: "" }} />,
      );

      expect(setButton).toBeEnabled();
      expect(defaultButton).toBeEnabled();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    },
  );

  it("sends zero default without changing the draft input", async () => {
    const { props } = setup();

    fireEvent.change(screen.getByLabelText("Set value"), { target: { value: "MIN" } });
    fireEvent.click(screen.getByRole("button", { name: "Default" }));

    await waitFor(() => expect(props.refreshScpiQuery).toHaveBeenCalledTimes(1));

    expect(props.sendScpiCommand.mock.calls[0][0]).toBe("MEAS:CURR:REL CH1, 0");
    expect(screen.getByLabelText("Set value")).toHaveValue("MIN");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each(["", "   "])("hides blank default %j", (defaultValue) => {
    setup({ config: { ...WRITE_CONFIG, defaultValue } });

    expect(screen.queryByRole("button", { name: "Default" })).not.toBeInTheDocument();
  });

  it("does not refresh after failed writes", async () => {
    const { props } = setup({
      sendScpiCommand: vi.fn().mockRejectedValue(new Error("SCPI command timed out.")),
    });

    fireEvent.click(screen.getByRole("button", { name: "Default" }));

    expect(await screen.findByText("Set failed: SCPI command timed out.")).toBeInTheDocument();
    expect(props.refreshScpiQuery).not.toHaveBeenCalled();
  });

  it("distinguishes refresh send failures from write failures", async () => {
    setup({ refreshScpiQuery: vi.fn(() => false) });

    fireEvent.click(screen.getByRole("button", { name: "Default" }));

    expect(await screen.findByText(/Refresh failed:/)).toBeInTheDocument();
  });

  it("shows refresh response errors", async () => {
    const { props, rerender } = setup({ snapshot: { loading: true, error: "" } });

    fireEvent.click(screen.getByRole("button", { name: "Default" }));
    await waitFor(() => expect(props.refreshScpiQuery).toHaveBeenCalled());

    // Query errors arrive later through the shared measurement snapshot.
    rerender(
      <SingleValueSetControls
        {...props}
        snapshot={{ loading: false, error: "ERR failed" }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Refresh failed: ERR failed");
  });

  it.each(["disconnect", "config"])(
    "discards refresh feedback after %s changes the active device context",
    async (change) => {
      const { props, rerender } = setup({ snapshot: { loading: true, error: "" } });

      fireEvent.click(screen.getByRole("button", { name: "Default" }));
      await waitFor(() => expect(props.refreshScpiQuery).toHaveBeenCalled());

      // The next context's query error must not be reported as this action's failure.
      rerender(
        <SingleValueSetControls
          {...props}
          connected={change !== "disconnect"}
          config={change === "config" ? { ...WRITE_CONFIG, deviceName: "PSU2" } : WRITE_CONFIG}
          snapshot={{ loading: false, error: "Other query failed" }}
        />,
      );

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    },
  );

  it.each(["disconnect", "config", "unmount"])(
    "ignores write completion after %s",
    async (change) => {
      const pendingWrite = createPendingWrite();
      const { props, rerender, unmount } = setup({
        sendScpiCommand: vi.fn(() => pendingWrite.promise),
      });

      fireEvent.click(screen.getByRole("button", { name: "Default" }));

      if (change === "unmount") {
        unmount();
      } else {
        const nextConfig = change === "config"
          ? { ...WRITE_CONFIG, setValueCommand: "VOLT {value}" }
          : WRITE_CONFIG;

        rerender(
          <SingleValueSetControls
            {...props}
            config={nextConfig}
            connected={change !== "disconnect"}
          />,
        );
      }

      // This reply belongs to the previous connection/configuration or disposed widget.
      await act(async () => pendingWrite.acknowledge());

      expect(props.refreshScpiQuery).not.toHaveBeenCalled();
    },
  );

  it("disables disconnected writes and rejects control characters", () => {
    const { props, rerender } = setup({ connected: false });

    expect(screen.getByRole("button", { name: "Default" })).toBeDisabled();

    rerender(<SingleValueSetControls {...props} connected />);
    fireEvent.change(screen.getByLabelText("Set value"), {
      target: { value: "OFF\u0001" },
    });

    expect(screen.getByRole("button", { name: "Set", exact: true })).toBeDisabled();
  });
});
