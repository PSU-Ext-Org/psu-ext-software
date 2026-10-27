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
import { mockConnection, saveConfig, delay } from "./protectionCardFixture.jsx";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProtectionControlCard } from "../components/ProtectionControlCard.jsx";

describe("ProtectionControlCard.readings", () => {
  it("checks OVP status on mount without rendering enable controls", async () => {
    saveConfig("protection-main", {
      cardName: "OVP CH1",
      unit: "V",
      protectionKey: "OVP",
      valueQuery: "OVP? CH1",
      valueSetTemplate: "OVP CH1,{value}",
      tripQuery: "OVP:PROTect:STATe? CH1",
      maxValue: 30,
    });
    mockConnection.sendScpiCommand
      .mockResolvedValueOnce({ ok: true, response: "25.0000" })
      .mockResolvedValueOnce({ ok: true, response: "0" });

    const { rerender } = render(<ProtectionControlCard placement={{ id: "protection-main" }} />);

    expect(await screen.findByText("25.0000")).toBeInTheDocument();
    expect(screen.getByTestId("protection-value-protection-main")).toHaveStyle({ color: "#0f766e" });
    expect(screen.queryByRole("button", { name: "Enable" })).not.toBeInTheDocument();
    expect(screen.getByText("Always on")).toBeInTheDocument();
    mockConnection.deviceStatuses = { 0: { state: "DISCONNECTED" } };
    rerender(<ProtectionControlCard placement={{ id: "protection-main" }} />);
    expect(screen.queryByText("25.0000")).not.toBeInTheDocument();
    expect(screen.getByTestId("protection-value-protection-main")).toHaveTextContent("--");
  });

  it("emits one trip event when polling detects a newly latched protection", async () => {
    saveConfig("protection-main", {
      cardName: "OVP CH1",
      unit: "V",
      protectionKey: "OVP",
      valueQuery: "OVP? CH1",
      valueSetTemplate: "OVP CH1,{value}",
      tripQuery: "OVP:PROTect:STATe? CH1",
      maxValue: 30,
      frequencyHz: 50,
    });
    const listener = vi.fn();
    window.addEventListener("psu-ext-protection-trip", listener);
    mockConnection.sendScpiCommand
      .mockResolvedValueOnce({ ok: true, response: "25.0000" })
      .mockResolvedValueOnce({ ok: true, response: "0" })
      .mockResolvedValueOnce({ ok: true, response: "1" })
      .mockResolvedValueOnce({ ok: true, response: "1" });

    render(<ProtectionControlCard placement={{ id: "protection-main" }} />);

    await waitFor(() => expect(listener).toHaveBeenCalledTimes(1), { timeout: 1000 });
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          widgetId: "protection-main",
          deviceName: "PSU1",
          channel: "CH1",
          protectionKey: "OVP",
          tripped: true,
          thresholdValue: "25.0000",
          enabled: true,
          source: "poll",
        }),
      }),
    );

    await delay(60);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("psu-ext-protection-trip", listener);
  }, 10000);

  it("keeps input focus during scheduled trip polling", async () => {
    saveConfig("protection-main", {
      cardName: "OVP CH1",
      unit: "V",
      protectionKey: "OVP",
      valueQuery: "OVP? CH1",
      valueSetTemplate: "OVP CH1,{value}",
      tripQuery: "OVP:PROTect:STATe? CH1",
      maxValue: 30,
      frequencyHz: 50,
    });
    mockConnection.sendScpiCommand
      .mockResolvedValueOnce({ ok: true, response: "25.0000" })
      .mockResolvedValueOnce({ ok: true, response: "0" })
      .mockResolvedValue({ ok: true, response: "0" });

    render(<ProtectionControlCard placement={{ id: "protection-main" }} />);

    expect(await screen.findByText("25.0000")).toBeInTheDocument();
    const input = screen.getByLabelText("Protection threshold");
    input.focus();
    expect(document.activeElement).toBe(input);

    await delay(60);
    expect(document.activeElement).toBe(input);
  });
});
