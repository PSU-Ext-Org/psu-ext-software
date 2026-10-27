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
import "./protectionCardFixture.jsx";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProtectionControlActions, ProtectionControlCard } from "../components/ProtectionControlCard.jsx";
import { WIDGET_CONFIG_STORAGE_KEY } from "../../widgetConfigStore.js";

describe("ProtectionControlCard", () => {
  it("renders unconfigured state", () => {
    render(<ProtectionControlCard placement={{ id: "protection-main" }} />);

    expect(
      screen.getByText("Configure protection value, trip, and optional enable commands."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Configure" })).toBeInTheDocument();
  });

  it("saves settings under the placement id", () => {
    render(<ProtectionControlActions placement={{ id: "protection-main" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Configure protection control card" }));
    fireEvent.change(screen.getByLabelText("Device"), { target: { value: "PSU1" } });
    fireEvent.change(screen.getByLabelText("Card name"), { target: { value: "OVP CH1" } });
    fireEvent.change(screen.getByLabelText("Protection key"), { target: { value: "OVP" } });
    fireEvent.change(screen.getByLabelText("Channel"), { target: { value: "CH1" } });
    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "V" } });
    fireEvent.change(screen.getByLabelText("Trip poll (Hz)"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Value color"), { target: { value: "#dc2626" } });
    fireEvent.change(screen.getByLabelText("Value query"), { target: { value: "OVP? CH1" } });
    fireEvent.change(screen.getByLabelText("Value set template"), { target: { value: "OVP CH1,{value}" } });
    fireEvent.change(screen.getByLabelText("Trip query"), {
      target: { value: "OVP:PROTect:STATe? CH1" },
    });
    fireEvent.change(screen.getByLabelText("Min value"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Max value"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Decimals"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(JSON.parse(window.localStorage.getItem(WIDGET_CONFIG_STORAGE_KEY))).toMatchObject({
      "protection-main": {
        type: "protectionControl",
        deviceName: "PSU1",
        cardName: "OVP CH1",
        valueColor: "#dc2626",
        unit: "V",
        channel: "CH1",
        protectionKey: "OVP",
        frequencyHz: 2,
        valueQuery: "OVP? CH1",
        valueSetTemplate: "OVP CH1,{value}",
        tripQuery: "OVP:PROTect:STATe? CH1",
        minValue: 0,
        maxValue: 30,
        decimals: 4,
      },
    });
  });

});
