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

import { IdeSaveScriptDialog } from "../IdeSaveScriptDialog.jsx";

describe("IdeSaveScriptDialog", () => {
  afterEach(cleanup);

  it("submits locally edited metadata", () => {
    const onSave = vi.fn();
    render(
      <IdeSaveScriptDialog
        initialName="Original"
        initialTags={[]}
        onCancel={vi.fn()}
        onSave={onSave}
        saving={false}
        tagHints={{ error: "", loading: false, tags: ["measurement"] }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Copy" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith({ name: "Copy", tags: [] });
  });

  it("cancels without submitting draft metadata", () => {
    const onCancel = vi.fn();
    const onSave = vi.fn();
    render(
      <IdeSaveScriptDialog
        initialName="Original"
        initialTags={[]}
        onCancel={onCancel}
        onSave={onSave}
        saving={false}
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Discarded draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });
});
