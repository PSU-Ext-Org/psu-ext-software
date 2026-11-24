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
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DeviceFormModal } from "../components/DeviceFormModal.jsx";

afterEach(cleanup);

it("validates serial fields and submits only USB settings after switching from TCP", async () => {
  const addDevice = vi.fn().mockResolvedValue();
  const onClose = vi.fn();
  render(<DeviceFormModal manager={{ addDevice }} onClose={onClose} />);

  const form = within(screen.getByRole("dialog", { name: "Add Device" }));
  const name = form.getByLabelText("Name *");
  const ip = form.getByLabelText("IP *");
  const tcpPort = form.getByLabelText("Port *");
  expect(name).toHaveAttribute("placeholder", "PSUEXT1");
  expect(name).toHaveValue("");
  expect(name).toHaveAccessibleDescription("Use 1 to 8 letters or digits for the device name.");
  expect(name).not.toHaveAttribute("aria-invalid");
  expect(ip).toHaveAttribute("placeholder", "192.168.4.1");
  expect(tcpPort).toHaveAttribute("placeholder", "5025");

  fireEvent.change(name, { target: { value: "SERIAL2" } });
  fireEvent.change(ip, { target: { value: "psu.local" } });
  fireEvent.change(tcpPort, { target: { value: "5025" } });
  fireEvent.change(form.getByLabelText("Type *"), { target: { value: "USB" } });

  const port = form.getByLabelText("COM Port *");
  const baudrate = form.getByLabelText("Baudrate *");
  const addButton = form.getByRole("button", { name: "Add Device" });
  expect(port).toHaveAttribute("placeholder", "COM3");
  expect(baudrate).toHaveAttribute("placeholder", "9600");
  expect(port).toHaveValue("");
  fireEvent.change(baudrate, { target: { value: "115200" } });
  fireEvent.change(port, { target: { value: "   " } });
  expect(addButton).toBeDisabled();
  expect(port).toHaveAccessibleDescription("Enter a serial port.");

  fireEvent.change(port, { target: { value: "  /dev/ttyUSB0  " } });
  for (const value of ["   ", "abc", "0", "-1", "1.5", "2147483648"]) {
    fireEvent.change(baudrate, { target: { value } });
    expect(addButton).toBeDisabled();
    expect(baudrate).toHaveAccessibleDescription("Enter a whole number from 1 to 2147483647.");
  }
  fireEvent.submit(addButton.form);
  expect(addDevice).not.toHaveBeenCalled();

  fireEvent.change(baudrate, { target: { value: "  115200  " } });
  expect(addButton).toBeEnabled();
  fireEvent.click(addButton);
  expect(addDevice).toHaveBeenCalledWith({
    name: "SERIAL2",
    type: "USB",
    ip: "",
    port: "/dev/ttyUSB0",
    baudrate: "115200",
  });
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
});
