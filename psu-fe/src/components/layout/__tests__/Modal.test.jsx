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
import { Modal } from "../dialogs/Modal.jsx";

describe("Modal", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the title and children", () => {
    render(
      <Modal title="Test Title" onClose={() => {}}>
        <p>Modal body</p>
      </Modal>,
    );

    expect(screen.getByRole("heading", { name: "Test Title" })).toBeInTheDocument();
    expect(screen.getByText("Modal body")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    const handleClose = vi.fn();
    render(
      <Modal title="Closeable" onClose={handleClose}>
        <p>Content</p>
      </Modal>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(handleClose).toHaveBeenCalledOnce();
  });

  it("closes with Escape and focuses the first input", async () => {
    const handleClose = vi.fn();
    render(
      <Modal title="Keyboard" onClose={handleClose}>
        <input aria-label="First field" />
        <input aria-label="Second field" />
      </Modal>,
    );

    await waitFor(() => expect(screen.getByLabelText("First field")).toHaveFocus());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledOnce();
  });

  it("renders as a fixed overlay covering the viewport", () => {
    render(
      <Modal title="Overlay" onClose={() => {}}>
        <p>Content</p>
      </Modal>,
    );

    const overlay = screen.getByRole("heading", { name: "Overlay" }).closest(".fixed");
    expect(overlay).toHaveClass("fixed", "inset-0", "z-50");
  });
});
