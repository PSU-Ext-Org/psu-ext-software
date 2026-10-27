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
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeviceTable } from "./DeviceTable.jsx";

afterEach(cleanup);

describe("device recovery status", () => {
  it.each(["DISCONNECTED", "CONNECTING"])("shows yellow Reconnecting while %s", (state) => {
    const disconnectDevice = vi.fn();
    render(<DeviceTable rows={[{
      device: { id: "1", name: "USB1", type: "USB", port: "COM3", baudrate: "115200" },
      status: { state, reconnecting: true }, autoConnect: false, connecting: state === "CONNECTING",
    }]} manager={{ disconnectDevice }} />);
    expect(screen.getByText("Reconnecting")).toHaveClass("bg-yellow-100", "text-yellow-800");
    expect(screen.queryByText(state)).not.toBeInTheDocument();
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(cancel).toHaveClass("bg-red-700");
    expect(cancel).toBeEnabled();
    fireEvent.click(cancel);
    expect(disconnectDevice).toHaveBeenCalledWith("1");
  });

  it.each(["CONNECTED", "DISCONNECTED", "CONNECTING"])("preserves ordinary %s status", (state) => {
    render(<DeviceTable rows={[{
      device: { id: "1", name: "USB1", type: "USB" },
      status: { state, reconnecting: false }, autoConnect: false, connecting: state === "CONNECTING",
    }]} manager={{}} />);
    expect(screen.getByText(state)).not.toHaveClass("bg-yellow-100");
    expect(screen.queryByText("Reconnecting")).not.toBeInTheDocument();
  });
});

