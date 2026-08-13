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

import { IdeScriptEditor } from "../IdeScriptEditor.jsx";

vi.mock("../../widgets/scriptEditor/components/ScriptEditor.jsx", () => ({
  ScriptEditor: ({ onChange, value }) => <textarea aria-label="JavaScript source editor" onChange={(event) => onChange(event.target.value)} value={value} />,
}));

describe("IdeScriptEditor", () => {
  afterEach(cleanup);

  it("shows a discard confirmation before replacing a changed document", async () => {
    const props = editorProps();
    const { rerender } = render(<IdeScriptEditor {...props} />);
    fireEvent.change(screen.getByLabelText("JavaScript source editor"), { target: { value: "(() => { return 2; })();" } });

    rerender(<IdeScriptEditor {...props} document={{ id: "next", name: "Next", sourceCode: "(() => { return 3; })();" }} />);

    expect(screen.getByText("Discard unsaved changes?")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue Editing" })).toHaveFocus());
  });

  it("marks a modified saved script as dirty next to its filename", () => {
    render(<IdeScriptEditor {...editorProps()} />);
    const sourceEditor = screen.getByLabelText("JavaScript source editor");

    expect(screen.getByText(/Current\.js$/)).toBeInTheDocument();
    fireEvent.change(sourceEditor, { target: { value: "(() => { return 2; })();" } });
    expect(screen.getByText(/Current\.js \*$/)).toBeInTheDocument();

    fireEvent.change(sourceEditor, { target: { value: "(() => { return 1; })();" } });
    expect(screen.getByText(/Current\.js$/)).toBeInTheDocument();
  });

  it("runs a loaded template as a new user source", async () => {
    const onRun = vi.fn(() => Promise.resolve({ script: { id: "user-1", name: "Record", sourceCode: "(() => { return 1; })();" } }));
    const loadBuiltinTemplates = vi.fn(() => Promise.resolve({ items: [{ id: "record", name: "Record" }] }));
    render(<IdeScriptEditor {...editorProps({ loadBuiltinTemplates, onRun })} />);
    await waitFor(() => expect(loadBuiltinTemplates).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("button", { name: "File" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Load Template" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Record" }));
    await waitFor(() => expect(screen.getByText("* · Record.js")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await vi.waitFor(() => expect(onRun).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Record" }),
      null,
    ));
  });

  it("opens Save Script As before saving a new document", async () => {
    const onPersist = vi.fn(() => Promise.resolve({ id: "created", name: "New Script", sourceCode: "(() => {})();", tags: [] }));
    const tagHints = { error: "", load: vi.fn(), loading: false, reload: vi.fn(), tags: [] };
    render(<IdeScriptEditor {...editorProps({ document: {}, onPersist, tagHints })} />);

    fireEvent.click(screen.getByRole("button", { name: "File" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Save" }));

    expect(screen.getByRole("dialog", { name: "Save Script As" })).toBeInTheDocument();
    expect(onPersist).not.toHaveBeenCalled();
    expect(tagHints.load).toHaveBeenCalledOnce();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New Script" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onPersist).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Script" }),
      null,
      true,
    ));
  });

  it("overwrites an existing script with Save", async () => {
    const onPersist = vi.fn((script) => Promise.resolve({ id: "current", ...script }));
    render(<IdeScriptEditor {...editorProps({ onPersist })} />);

    fireEvent.click(screen.getByRole("button", { name: "File" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Save" }));

    await waitFor(() => expect(onPersist).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Current" }),
      "current",
      false,
    ));
    expect(screen.queryByRole("dialog", { name: "Save Script As" })).not.toBeInTheDocument();
  });

  it("creates a copy of an existing script with Save As", async () => {
    const onPersist = vi.fn((script) => Promise.resolve({ id: "copy", ...script }));
    render(<IdeScriptEditor {...editorProps({ onPersist })} />);

    fireEvent.click(screen.getByRole("button", { name: "File" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Save As" }));
    expect(screen.getByRole("dialog", { name: "Save Script As" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onPersist).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Current" }),
      null,
      true,
    ));
  });
});

function editorProps(overrides = {}) {
  return {
    document: { id: "current", name: "Current", sourceCode: "(() => { return 1; })();" },
    loadBindings: () => Promise.resolve({ items: [] }),
    loadBuiltinDetail: () => Promise.resolve({ id: "record", name: "Record", sourceCode: "(() => { return 1; })();" }),
    loadBuiltinTemplates: () => Promise.resolve({ items: [{ id: "record", name: "Record" }] }),
    onClose: vi.fn(),
    onOpenDocument: vi.fn(),
    onOpenPopup: vi.fn(),
    onPersist: vi.fn(),
    onRun: vi.fn(),
    ...overrides,
  };
}
