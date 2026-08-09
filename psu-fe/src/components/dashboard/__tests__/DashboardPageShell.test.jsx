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
import { DashboardPageShell } from "../components/DashboardPageShell.jsx";

const STORAGE_KEY = "dashboard-shell-test";
const DEFAULT_LAYOUT = [
  { id: "alpha", type: "alpha", x: 0, y: 0, w: 1, h: 1 },
  { id: "beta", type: "beta", x: 1, y: 0, w: 2, h: 1 },
];
const WIDGETS = {
  alpha: {
    title: "Alpha Widget",
    text: "First mock widget.",
    render: () => <p>Alpha body</p>,
  },
  beta: {
    title: "Beta Widget",
    text: "Second mock widget.",
    render: () => <p>Beta body</p>,
  },
};

function renderShell({
  availableWidgets = [],
  columns,
  defaultLayout = DEFAULT_LAYOUT,
  editable = false,
  gridTemplateRows,
  pageId = "test-dashboard",
  rowHeight,
  storageKey = STORAGE_KEY,
  widgets = WIDGETS,
  ...events
} = {}) {
  const layout = {
    defaultLayout,
    ...(columns === undefined ? {} : { columns }),
    ...(gridTemplateRows === undefined ? {} : { gridTemplateRows }),
    ...(rowHeight === undefined ? {} : { rowHeight }),
  };

  render(
    <DashboardPageShell
      dashboard={{
        identity: { pageId, storageKey },
        layout,
        widgets: { available: availableWidgets, definitions: widgets, editable },
      }}
      {...events}
    />,
  );
}

function getStoredLayout() {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY));
}

function getDefaultLayoutHash() {
  return JSON.stringify({
    columns: 3,
    widgets: DEFAULT_LAYOUT.map(({ id, type, x, y, w, h }) => ({ id, type, x, y, w, h })),
  });
}

describe("DashboardPageShell", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("creates and persists a layout id on first load", () => {
    renderShell();

    const storedLayout = getStoredLayout();

    expect(storedLayout.layoutId).toEqual(expect.any(String));
    expect(storedLayout.layoutHash).toBe(getDefaultLayoutHash());
    expect(storedLayout.widgets).toEqual(DEFAULT_LAYOUT);
    expect(screen.getByTestId("dashboard-layout-id")).toHaveTextContent(storedLayout.layoutId);
  });

  it("hides edit controls in static mode", () => {
    renderShell();

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Widget" })).not.toBeInTheDocument();
  });

  it("marks the grid and widgets for narrow-screen stacking", () => {
    renderShell();

    expect(screen.getByLabelText("Dashboard widget grid")).toHaveClass("dashboard-grid");
    expect(screen.getByLabelText("Beta Widget")).toHaveClass("dashboard-widget");
    expect(screen.getByLabelText("Beta Widget")).toHaveStyle({
      "--dashboard-widget-height": "1",
    });
  });

  it("keeps widget content scrollable inside the dashboard frame", () => {
    renderShell();

    expect(screen.getByText("Alpha body").parentElement).toHaveClass("overflow-auto");
    expect(screen.getByLabelText("Alpha Widget")).toHaveClass("flex", "flex-col", "overflow-hidden");
  });

  it("restores a persisted widget layout", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        layoutId: "layout-existing",
        layoutHash: getDefaultLayoutHash(),
        widgets: [
          { id: "alpha", type: "alpha", x: 2, y: 3, w: 1, h: 1 },
          { id: "beta", type: "beta", x: 0, y: 4, w: 2, h: 1 },
        ],
      }),
    );

    renderShell();

    expect(screen.getByTestId("dashboard-layout-id")).toHaveTextContent("layout-existing");
    expect(screen.getByLabelText("Alpha Widget")).toHaveStyle({
      gridColumn: "3 / span 1",
      gridRow: "4 / span 1",
    });
    expect(screen.getByLabelText("Beta Widget")).toHaveStyle({
      gridColumn: "1 / span 2",
      gridRow: "5 / span 1",
    });
  });

  it("falls back to defaults when the stored layout is invalid", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        layoutId: "layout-invalid",
        layoutHash: getDefaultLayoutHash(),
        widgets: [
          { id: "alpha", type: "alpha", x: 0, y: 0, w: 3, h: 1 },
          { id: "beta", type: "beta", x: 1, y: 0, w: 2, h: 1 },
        ],
      }),
    );

    renderShell();

    expect(screen.getByLabelText("Alpha Widget")).toHaveStyle({
      gridColumn: "1 / span 3",
    });
    expect(screen.getByLabelText("Beta Widget")).toHaveStyle({
      gridColumn: "1 / span 2",
      gridRow: "2 / span 1",
    });
  });

  it("toggles edit mode and resets layout to defaults", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        layoutId: "layout-custom",
        layoutHash: getDefaultLayoutHash(),
        widgets: [
          { id: "alpha", type: "alpha", x: 2, y: 2, w: 1, h: 1 },
          { id: "beta", type: "beta", x: 0, y: 3, w: 2, h: 1 },
        ],
      }),
    );

    renderShell({ editable: true });

    expect(screen.getByLabelText("Alpha Widget")).not.toHaveClass("cursor-grab");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText("Alpha Widget")).toHaveClass("cursor-grab");

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByLabelText("Alpha Widget")).toHaveStyle({
      gridColumn: "1 / span 1",
      gridRow: "1 / span 1",
    });
    expect(screen.getByLabelText("Beta Widget")).toHaveStyle({
      gridColumn: "2 / span 2",
      gridRow: "1 / span 1",
    });
  });

  it("creates an editable empty dynamic layout", () => {
    renderShell({
      defaultLayout: [],
      editable: true,
      availableWidgets: [{ type: "alpha", label: "Alpha" }],
    });

    expect(getStoredLayout().widgets).toEqual([]);
    expect(screen.getByLabelText("Dashboard widget grid")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("group", { name: "Add widget" })).toBeInTheDocument();
    expect(screen.getByLabelText("Widget type")).toHaveValue("alpha::Alpha::");
    expect(screen.getByRole("button", { name: "Add selected widget" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Alpha Widget")).not.toBeInTheDocument();
  });

  it("falls back to defaults when a static stored layout hash is stale", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        layoutId: "layout-stale",
        layoutHash: "stale-layout-hash",
        widgets: [
          { id: "alpha", type: "alpha", x: 2, y: 3, w: 1, h: 1 },
          { id: "beta", type: "beta", x: 0, y: 4, w: 2, h: 1 },
        ],
      }),
    );

    renderShell();

    expect(screen.getByLabelText("Alpha Widget")).toHaveStyle({
      gridColumn: "1 / span 1",
      gridRow: "1 / span 1",
    });
    expect(screen.getByLabelText("Beta Widget")).toHaveStyle({
      gridColumn: "2 / span 2",
      gridRow: "1 / span 1",
    });
  });

  it("adds an available widget at the first open slot", () => {
    renderShell({
      defaultLayout: [],
      editable: true,
      availableWidgets: [{ type: "alpha", label: "Alpha", idPrefix: "alpha-test", w: 1, h: 1 }],
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Add selected widget" }));

    const storedWidget = getStoredLayout().widgets[0];
    expect(storedWidget).toMatchObject({ type: "alpha", x: 0, y: 0, w: 1, h: 1 });
    expect(storedWidget.id).toMatch(/^alpha-test-/);
    expect(screen.getByLabelText("Alpha Widget")).toHaveStyle({
      gridColumn: "1 / span 1",
      gridRow: "1 / span 1",
    });
  });

  it("deletes dynamic widgets and reports removed placement", () => {
    const handleWidgetRemoved = vi.fn();
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        layoutId: "layout-dynamic",
        widgets: [{ id: "alpha-existing", type: "alpha", x: 0, y: 0, w: 1, h: 1 }],
      }),
    );

    renderShell({
      defaultLayout: [],
      editable: true,
      availableWidgets: [{ type: "alpha", label: "Alpha" }],
      onWidgetRemoved: handleWidgetRemoved,
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Alpha Widget" }));

    expect(screen.queryByLabelText("Alpha Widget")).not.toBeInTheDocument();
    expect(getStoredLayout().widgets).toEqual([]);
    expect(handleWidgetRemoved).toHaveBeenCalledWith(
      expect.objectContaining({ id: "alpha-existing", type: "alpha" }),
    );
  });

  it("ignores invalid stored dynamic widget types", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        layoutId: "layout-invalid-dynamic",
        widgets: [
          { id: "alpha-existing", type: "alpha", x: 0, y: 0, w: 1, h: 1 },
          { id: "unknown-existing", type: "unknown", x: 1, y: 0, w: 1, h: 1 },
        ],
      }),
    );

    renderShell({
      defaultLayout: [],
      editable: true,
      availableWidgets: [{ type: "alpha", label: "Alpha" }],
    });

    expect(screen.getByLabelText("Alpha Widget")).toBeInTheDocument();
    expect(getStoredLayout().widgets).toEqual([
      { id: "alpha-existing", type: "alpha", x: 0, y: 0, w: 1, h: 1 },
    ]);
  });

  it("moves a widget after a valid pointer drag", () => {
    renderShell({ editable: true });

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getRect() {
      if (this.getAttribute("aria-label") === "Dashboard widget grid") {
        return {
          bottom: 816,
          height: 816,
          left: 0,
          right: 632,
          top: 0,
          width: 632,
          x: 0,
          y: 0,
          toJSON: () => {},
        };
      }

      if (this.getAttribute("aria-label") === "Alpha Widget") {
        return {
          bottom: 256,
          height: 256,
          left: 0,
          right: 200,
          top: 0,
          width: 200,
          x: 0,
          y: 0,
          toJSON: () => {},
        };
      }

      return {
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
      };
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.pointerDown(screen.getByLabelText("Alpha Widget"), {
      button: 0,
      clientX: 100,
      clientY: 128,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, {
      clientX: 100,
      clientY: 672,
      pointerId: 1,
    });

    expect(screen.getByLabelText("Alpha Widget")).toHaveStyle({
      gridColumn: "1 / span 1",
      gridRow: "1 / span 1",
      transform: "translate3d(0px, 544px, 0)",
    });
    expect(screen.getByTestId("dashboard-drop-placeholder")).toHaveStyle({
      gridColumn: "1 / span 1",
      gridRow: "3 / span 1",
    });
    expect(document.body).toHaveClass("dashboard-widget-dragging");

    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(screen.getByLabelText("Alpha Widget")).toHaveStyle({
      gridColumn: "1 / span 1",
      gridRow: "3 / span 1",
    });
    expect(screen.queryByTestId("dashboard-drop-placeholder")).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass("dashboard-widget-dragging");
    expect(getStoredLayout().widgets.find((widget) => widget.id === "alpha")).toMatchObject({
      x: 0,
      y: 2,
    });
  });

  it("cancels a pointer drag without changing the saved layout", () => {
    renderShell({ editable: true });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.pointerDown(screen.getByLabelText("Alpha Widget"), {
      button: 0,
      clientX: 20,
      clientY: 20,
      pointerId: 4,
    });

    expect(screen.getByTestId("dashboard-drop-placeholder")).toBeInTheDocument();
    expect(document.body).toHaveClass("dashboard-widget-dragging");

    fireEvent.pointerCancel(window, { pointerId: 4 });

    expect(screen.queryByTestId("dashboard-drop-placeholder")).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass("dashboard-widget-dragging");
    expect(getStoredLayout().widgets).toEqual(DEFAULT_LAYOUT);
  });
});
