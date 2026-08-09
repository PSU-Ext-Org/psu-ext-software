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
import { afterEach, expect, it, vi } from "vitest";
import { TagSetInput } from "../components/TagSetInput.jsx";

afterEach(cleanup);

it("suggests, adds, de-duplicates, removes, and accepts custom tags", () => {
  const onChange = vi.fn();
  const { rerender } = render(<TagSetInput label="Tags" onChange={onChange} suggestions={["measurement", "voltage"]} value={[]} />);
  const input = screen.getByLabelText("Tags");

  fireEvent.change(input, { target: { value: "mea" } });
  fireEvent.click(screen.getByRole("option", { name: "measurement" }));
  expect(onChange).toHaveBeenLastCalledWith(["measurement"]);

  rerender(<TagSetInput label="Tags" onChange={onChange} suggestions={["measurement", "voltage"]} value={["measurement"]} />);
  fireEvent.change(screen.getByLabelText("Tags"), { target: { value: "custom" } });
  fireEvent.keyDown(screen.getByLabelText("Tags"), { key: "Enter" });
  expect(onChange).toHaveBeenLastCalledWith(["measurement", "custom"]);

  fireEvent.change(screen.getByLabelText("Tags"), { target: { value: "measurement," } });
  expect(onChange).toHaveBeenLastCalledWith(["measurement", "custom"]);
  fireEvent.click(screen.getByLabelText("Remove tag measurement"));
  expect(onChange).toHaveBeenLastCalledWith([]);
});

it("adds the keyboard-selected suggestion with Enter", () => {
  const onChange = vi.fn();
  render(<TagSetInput label="Tags" onChange={onChange} suggestions={["measurement", "voltage"]} value={[]} />);
  const input = screen.getByLabelText("Tags");

  fireEvent.change(input, { target: { value: "v" } });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  expect(screen.getByRole("option", { name: "voltage" })).toHaveAttribute("aria-selected", "true");
  fireEvent.keyDown(input, { key: "Enter" });

  expect(onChange).toHaveBeenLastCalledWith(["voltage"]);
});
