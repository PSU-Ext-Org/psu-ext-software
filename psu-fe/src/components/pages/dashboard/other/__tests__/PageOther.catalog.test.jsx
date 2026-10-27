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
import { PageOther } from "../PageOther.jsx";
import { PageDashboard } from "../../operator/PageDashboard.jsx";

const mockConnection = vi.hoisted(() => ({
  wsConnected: false,
  devices: [],
  deviceStatuses: {},
  subscribeScpiSnapshot: vi.fn(() => vi.fn()),
  getScpiQuerySnapshot: vi.fn(() => ({ value: "", updatedAt: 0, loading: false, error: "" })),
  sendScpiCommand: vi.fn(),
}));

vi.mock("../../../../../connection/ws-proxy/WebSocketConnectionContext.jsx", () => ({
  useWebSocketConnection: () => mockConnection,
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function openWidgetPicker() {
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  return screen.getByLabelText("Widget type");
}

function readWidgetChoices(picker) {
  return Array.from(picker.options, (option) => {
    const [type, , label, width, height] = option.value.split(":");
    return { type, label, width, height };
  });
}

describe("extra dashboard widget catalog", () => {
  it("offers exactly the main dashboard's widget types, labels, sizes, and order", () => {
    render(<PageDashboard />);
    const dashboardChoices = readWidgetChoices(openWidgetPicker());
    cleanup();

    render(<PageOther />);
    expect(readWidgetChoices(openWidgetPicker())).toEqual(dashboardChoices);
  });

  it.each([
    ["singleToggle", "Single Toggle", "Single Toggle", 1, 1],
    ["protectionControl", "Protection Control", "Protection Control", 1, 1],
    ["externalTriggerControl", "External Triggers 1x2", "External Triggers", 1, 2],
    ["timerQueueControl", "Timer Queue 2x2", "Timer Queue", 2, 2],
  ])("adds and renders %s independently of the primary layout", (type, label, title, w, h) => {
    const primaryLayout = { layoutId: "primary-saved", widgets: [] };
    localStorage.setItem("psu-ext.dashboard.operator-layout.v2", JSON.stringify(primaryLayout));
    render(<PageOther />);
    const picker = openWidgetPicker();
    const option = Array.from(picker.options).find((entry) => entry.textContent === label);
    expect(option).toBeDefined();
    fireEvent.change(picker, { target: { value: option.value } });
    fireEvent.click(screen.getByRole("button", { name: "Add selected widget" }));

    expect(screen.getByLabelText("Dashboard widget grid")).toHaveTextContent(title);
    const layout = JSON.parse(localStorage.getItem("psu-ext.dashboard.other-layout.v1"));
    expect(layout.widgets).toHaveLength(1);
    expect(layout.widgets[0]).toMatchObject({ type, w, h });
    expect(layout.widgets[0].id).toContain("other");
    expect(JSON.parse(localStorage.getItem("psu-ext.dashboard.operator-layout.v2"))).toEqual(primaryLayout);
  });
});
