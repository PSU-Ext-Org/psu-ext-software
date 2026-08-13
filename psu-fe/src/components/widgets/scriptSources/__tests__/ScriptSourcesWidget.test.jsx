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
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScriptSourcesActions, ScriptSourcesWidget } from "../components/ScriptSourcesWidget.jsx";
import { clearScriptTagHintCacheForTests } from "../hooks/useScriptTagHints.js";

vi.mock("../../../../connection/http-script/ScriptRunnerHttpContext.jsx", () => ({
  useScriptRunnerHttp: () => ({
    scriptSourceApiUrl: "http://runner.test/api/scripts/source",
    scriptTaskApiUrl: "http://runner.test/api/scripts",
    scriptBindingApiUrl: "http://runner.test/api/scripts/bindings",
  }),
}));

describe("ScriptSourcesWidget", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    clearScriptTagHintCacheForTests();
  });

  it("loads user scripts with backend name and tag filters", async () => {
    const fetchMock = vi.fn((url) => url.endsWith("/user/tags")
      ? Promise.resolve(jsonResponse(["measure", "fast"]))
      : Promise.resolve(pageResponse([summary("user-1", "Custom")], 1, 5)));
    vi.stubGlobal("fetch", fetchMock);

    render(<ScriptSourcesWidget />);
    expect(await screen.findByText("Custom")).toBeInTheDocument();
    expect(screen.queryByText("Built-in Scripts")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "voltage" } });
    fireEvent.change(screen.getByLabelText("Tags"), { target: { value: "measure," } });
    fireEvent.change(screen.getByLabelText("Tags"), { target: { value: "fast" } });
    fireEvent.keyDown(screen.getByLabelText("Tags"), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("name=voltage&tag=measure&tag=fast"),
      expect.anything(),
    ));
  });

  it("loads tag hints when the widget opens without blocking script loading on failure", async () => {
    const fetchMock = vi.fn((url) => url.endsWith("/user/tags")
      ? Promise.resolve({ ok: false, status: 503, text: () => Promise.resolve('{"message":"Unavailable"}') })
      : Promise.resolve(pageResponse([summary("user-1", "Custom")], 1, 5)));
    vi.stubGlobal("fetch", fetchMock);

    render(<ScriptSourcesWidget />);

    expect(await screen.findByText("Custom")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "http://runner.test/api/scripts/source/user/tags",
      expect.anything(),
    ));
    expect(screen.getByLabelText("Tags")).toBeEnabled();
  });

  it("applies filters with Enter from the name or unselected tag field", async () => {
    const fetchMock = vi.fn((url) => url.endsWith("/user/tags")
      ? Promise.resolve(jsonResponse(["voltage"]))
      : Promise.resolve(pageResponse([summary("user-1", "Custom")], 1, 5)));
    vi.stubGlobal("fetch", fetchMock);
    render(<ScriptSourcesWidget />);
    await screen.findByText("Custom");

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "voltage" } });
    fireEvent.keyDown(screen.getByLabelText("Name"), { key: "Enter" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("name=voltage"), expect.anything()));

    fireEvent.change(screen.getByLabelText("Tags"), { target: { value: "voltage" } });
    fireEvent.keyDown(screen.getByLabelText("Tags"), { key: "Enter" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("tag=voltage"), expect.anything()));
  });

  it("opens a script when its table row is clicked", async () => {
    const onOpenScript = vi.fn();
    const source = { ...summary("user-1", "Custom"), sourceCode: "(() => { return 1; })();" };
    const fetchMock = vi.fn((url) => url.endsWith("/user/user-1") ? Promise.resolve(detailResponse(source)) : Promise.resolve(pageResponse([summary("user-1", "Custom")], 1, 5)));
    vi.stubGlobal("fetch", fetchMock);

    render(<ScriptSourcesWidget onOpenScript={onOpenScript} />);
    const name = await screen.findByText("Custom");
    expect(name.closest("tr")).toHaveClass("cursor-pointer", "hover:bg-slate-50");
    fireEvent.click(name);

    await waitFor(() => expect(onOpenScript).toHaveBeenCalledWith(source));
  });

  it("loads a builtin template into the user-script create form", async () => {
    const fetchMock = vi.fn((url, options) => {
      if (url.endsWith("/builtin?limit=500&offset=0")) return Promise.resolve(pageResponse([summary("builtin-1", "Builtin")], 1, 500));
      if (url.endsWith("/builtin/builtin-1")) return Promise.resolve(detailResponse({ ...summary("builtin-1", "Builtin"), sourceCode: "(() => { return 1; })();" }));
      if (options?.method === "POST") return Promise.resolve(detailResponse({ ...summary("user-2", "User Copy"), sourceCode: "(() => { return 1; })();" }));
      return Promise.resolve(pageResponse([], 0, 5));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<><ScriptSourcesWidget /><ScriptSourcesActions /></>);

    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "New" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "http://runner.test/api/scripts/source/builtin?limit=500&offset=0",
      expect.anything(),
    ));
    fireEvent.click(screen.getByRole("button", { name: "File" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Load Template" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Builtin" }));

    await waitFor(() => expect(screen.getAllByLabelText("Name")[1]).toHaveValue("Builtin"));
    expect(screen.getByLabelText("JavaScript source editor")).toBeInTheDocument();
    fireEvent.change(screen.getAllByLabelText("Name")[1], { target: { value: "User Copy" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "http://runner.test/api/scripts/source/user",
      expect.objectContaining({ method: "POST" }),
    ));
  });

  it("deletes selected user scripts through the Actions menu", async () => {
    const fetchMock = vi.fn((url, options) => {
      if (options?.method === "DELETE") return Promise.resolve({ ok: true, status: 204, text: () => Promise.resolve("") });
      return Promise.resolve(pageResponse([summary("user-1", "Custom")], 1, 5));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<><ScriptSourcesWidget /><ScriptSourcesActions /></>);

    fireEvent.click(await screen.findByLabelText("Select script Custom"));
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeEnabled();
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(await screen.findByRole("heading", { name: "Delete Script" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "http://runner.test/api/scripts/source/user/user-1",
      expect.objectContaining({ method: "DELETE" }),
    ));
  });

  it("closes the Actions menu when clicking outside it", () => {
    render(<ScriptSourcesActions />);

    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("hides the bulk Run action for selected user scripts", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(pageResponse([summary("user-1", "Custom")], 1, 5)));
    vi.stubGlobal("fetch", fetchMock);
    render(<><ScriptSourcesWidget /><ScriptSourcesActions /></>);

    fireEvent.click(await screen.findByLabelText("Select script Custom"));
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.queryByRole("menuitem", { name: "Run" })).not.toBeInTheDocument();
  });
});

function summary(id, name) {
  return { id, name, tags: ["measurement"], origin: "USER", updatedAt: "2026-07-27T10:00:00Z" };
}

function pageResponse(items, total, limit) {
  return { ok: true, text: () => Promise.resolve(JSON.stringify({ items, total, limit, offset: 0 })) };
}

function detailResponse(item) {
  return { ok: true, text: () => Promise.resolve(JSON.stringify(item)) };
}

function jsonResponse(body) {
  return { ok: true, text: () => Promise.resolve(JSON.stringify(body)) };
}
