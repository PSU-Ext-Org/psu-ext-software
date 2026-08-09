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
import { ScriptRunnerHttpProvider } from "../../../connection/http-script/ScriptRunnerHttpContext.jsx";
import { SCRIPT_RUNNER_HTTP_CONFIG_KEY } from "../../../connection/http-script/scriptRunnerHttpConfig.js";
import { ScriptBackendConfigWidget } from "./ScriptBackendConfigWidget.jsx";

describe("ScriptBackendConfigWidget", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("tests the current draft endpoint without saving it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ScriptRunnerHttpProvider>
        <ScriptBackendConfigWidget />
      </ScriptRunnerHttpProvider>,
    );

    fireEvent.change(screen.getByLabelText("Root path"), { target: { value: "/runner/" } });
    fireEvent.click(screen.getByRole("button", { name: "Test Connection" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("http://localhost:8081/runner/actuator/health"));
    expect(await screen.findByText("Connected")).toBeInTheDocument();
    expect(window.localStorage.getItem(SCRIPT_RUNNER_HTTP_CONFIG_KEY)).toBeNull();
  });
});
