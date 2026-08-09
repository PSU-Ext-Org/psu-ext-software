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
import { ScriptTasksWidget } from "../components/ScriptTasksWidget.jsx";

vi.mock("../../../../connection/http-script/ScriptRunnerHttpContext.jsx", () => ({
  useScriptRunnerHttp: () => ({
    scriptTaskApiUrl: "http://runner.test/api/scripts",
  }),
}));

describe("ScriptTasksWidget", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("opens a task from its row without changing checkbox selection", async () => {
    const onOpenTask = vi.fn();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({ items: [task()], total: 1, limit: 9, offset: 0 })) })));
    render(<ScriptTasksWidget onOpenTask={onOpenTask} />);
    const name = await screen.findByText("Voltage check");
    expect(name.closest("tr")).toHaveClass("cursor-pointer", "hover:bg-slate-50");
    fireEvent.click(screen.getByLabelText("Select task Voltage check"));
    expect(onOpenTask).not.toHaveBeenCalled();
    fireEvent.click(name);
    expect(onOpenTask).toHaveBeenCalledWith(task());
  });
});

function task() { return { taskId: "abcde-123", name: "Voltage check", state: "RUNNING", progress: 0.5, createdAt: "2026-07-28T08:00:00Z", endedAt: null }; }
