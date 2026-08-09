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

import { ScriptSourceDialog } from "../components/ScriptSourceDialog.jsx";

vi.mock("../../scriptEditor/components/ScriptEditor.jsx", () => ({
  ScriptEditor: ({ onChange, value }) => <textarea aria-label="JavaScript source editor" onChange={(event) => onChange(event.target.value)} value={value} />,
}));

const WRAPPED_SOURCE = "(() => { return 1; })();";

describe("ScriptSourceDialog", () => {
  afterEach(cleanup);

  it("blocks saving an unwrapped script", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("JavaScript source editor"), { target: { value: "return 1;" } });

    expect(screen.getByText("Scripts must use the built-in (() => { … })(); wrapper.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("saves a valid source and closes the dialog", async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn(() => Promise.resolve({ id: "source-1", name: "Voltage", sourceCode: WRAPPED_SOURCE, tags: [] }));
    renderDialog({ onClose, onSubmit });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Voltage" } });
    fireEvent.change(screen.getByLabelText("JavaScript source editor"), { target: { value: WRAPPED_SOURCE } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("confirms before discarding changed source content", async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Changed" } });
    fireEvent.click(screen.getByLabelText("Close"));

    expect(screen.getByText("Discard unsaved changes?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue Editing" }));
    await waitFor(() => expect(screen.queryByText("Discard unsaved changes?")).not.toBeInTheDocument());
  });
});

function renderDialog(overrides = {}) {
  return render(
    <ScriptSourceDialog
      loadBindings={() => Promise.resolve({ items: [] })}
      loadBuiltinDetail={() => Promise.resolve({ sourceCode: WRAPPED_SOURCE })}
      loadBuiltinTemplates={() => Promise.resolve({ items: [] })}
      mode="create"
      onClose={vi.fn()}
      onRun={vi.fn()}
      onSubmit={vi.fn()}
      {...overrides}
    />,
  );
}
