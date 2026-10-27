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
import { mockConnection, saveConfig } from "./protectionCardFixture.jsx";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProtectionControlCard } from "../components/ProtectionControlCard.jsx";

describe("ProtectionControlCard.writes", () => {
  it("supports configurable enable state and threshold updates", async () => {
    saveConfig("protection-main", {
      cardName: "OCP CH1",
      unit: "A",
      protectionKey: "OCP",
      valueQuery: "OCP? CH1",
      valueSetTemplate: "OCP CH1,{value}",
      tripQuery: "OCP:PROTect:STATe? CH1",
      enableQuery: "OCP:STATe? CH1",
      enableOnCommand: "OCP:STATe CH1,1",
      enableOffCommand: "OCP:STATe CH1,0",
      maxValue: 10,
    });
    mockConnection.sendScpiCommand
      .mockResolvedValueOnce({ ok: true, response: "2.5000" })
      .mockResolvedValueOnce({ ok: true, response: "0" })
      .mockResolvedValueOnce({ ok: true, response: "1" })
      .mockResolvedValueOnce({ ok: true, response: "OK SENT" })
      .mockResolvedValueOnce({ ok: true, response: "3.1000" })
      .mockResolvedValueOnce({ ok: true, response: "0" })
      .mockResolvedValueOnce({ ok: true, response: "1" })
      .mockResolvedValueOnce({ ok: true, response: "OK SENT" })
      .mockResolvedValueOnce({ ok: true, response: "3.1000" })
      .mockResolvedValueOnce({ ok: true, response: "0" })
      .mockResolvedValueOnce({ ok: true, response: "0" });

    render(<ProtectionControlCard placement={{ id: "protection-main" }} />);

    expect(await screen.findByText("2.5000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disable protection" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Protection threshold"), { target: { value: "3.1" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply threshold" }));

    await waitFor(() => expect(screen.getByText("3.1000")).toBeInTheDocument());
    expect(mockConnection.sendScpiCommand).toHaveBeenCalledWith("OCP CH1,3.1000", "PSU1", {
      tag: "GUI",
      waitForResponse: true,
    });

    fireEvent.click(screen.getByRole("button", { name: "Disable protection" }));

    await waitFor(() => expect(screen.getByText("Disabled")).toBeInTheDocument());
    expect(mockConnection.sendScpiCommand).toHaveBeenCalledWith("OCP:STATe CH1,0", "PSU1", {
      tag: "GUI",
      waitForResponse: true,
    });
  });

  it("blocks invalid threshold input before sending a command", async () => {
    saveConfig("protection-main", {
      cardName: "OVP CH1",
      unit: "V",
      protectionKey: "OVP",
      valueQuery: "OVP? CH1",
      valueSetTemplate: "OVP CH1,{value}",
      tripQuery: "OVP:PROTect:STATe? CH1",
      maxValue: 30,
      decimals: 4,
    });
    mockConnection.sendScpiCommand
      .mockResolvedValueOnce({ ok: true, response: "25.0000" })
      .mockResolvedValueOnce({ ok: true, response: "0" });

    render(<ProtectionControlCard placement={{ id: "protection-main" }} />);

    expect(await screen.findByText("25.0000")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Protection threshold"), { target: { value: "29.12345" } });

    expect(screen.getByText("Value must use at most 4 decimal places.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply threshold" })).toBeDisabled();
  });

});
