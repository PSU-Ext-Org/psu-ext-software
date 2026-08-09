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
import { IdeMenuBar } from "../IdeMenuBar.jsx";

function renderMenu(overrides = {}) {
  const actions = { newFile: vi.fn(), run: vi.fn(), sources: vi.fn(), backend: vi.fn(), template: vi.fn() };
  render(<IdeMenuBar items={[
    { id: "file", label: "File", mnemonic: "f", globalMnemonic: true, children: [
      { id: "new", label: "New", mnemonic: "n", action: actions.newFile },
      { id: "templates", label: "Templates", mnemonic: "t", children: [{ id: "basic", label: "Basic", action: actions.template }] },
    ] },
    { id: "run", label: "Run", mnemonic: "r", globalMnemonic: true, action: actions.run },
    { id: "scripts", label: "Scripts", mnemonic: "c", globalMnemonic: true, children: [{ id: "sources", label: "Sources", mnemonic: "o", action: actions.sources }] },
    { id: "settings", label: "Settings", mnemonic: "t", globalMnemonic: true, children: [{ id: "backend", label: "Backend", mnemonic: "b", action: actions.backend }] },
    ...(overrides.items || []),
  ]} />);
  return actions;
}

describe("IdeMenuBar", () => {
  afterEach(cleanup);

  it("uses configured mnemonics and callbacks", () => {
    const actions = renderMenu();
    fireEvent.keyDown(document, { altKey: true, key: "c" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Scripts" }), { key: "o" });
    expect(actions.sources).toHaveBeenCalledOnce();

    fireEvent.keyDown(document, { altKey: true, key: "r" });
    expect(actions.run).toHaveBeenCalledOnce();
  });

  it("supports arrows, nested submenus, Enter, and Escape focus restoration", async () => {
    const actions = renderMenu();
    const file = screen.getByRole("button", { name: "File" });
    file.focus();
    fireEvent.keyDown(file, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "New" })).toHaveFocus());

    fireEvent.keyDown(screen.getByRole("menuitem", { name: "New" }), { key: "ArrowDown" });
    const templates = screen.getByRole("menuitem", { name: "Templates" });
    expect(templates).toHaveFocus();
    fireEvent.keyDown(templates, { key: "ArrowRight" });
    const basic = await screen.findByRole("menuitem", { name: "Basic" });
    await waitFor(() => expect(basic).toHaveFocus());
    fireEvent.keyDown(basic, { key: "Enter" });
    expect(actions.template).toHaveBeenCalledOnce();

    fireEvent.keyDown(document, { altKey: true, key: "f" });
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "New" }), { key: "Escape" });
    await waitFor(() => expect(file).toHaveFocus());
  });
});
