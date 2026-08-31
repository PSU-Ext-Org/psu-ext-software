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
import { ScriptTaskConsole } from "../components/console/ScriptTaskConsole.jsx";

vi.mock("../../chart/index.js", () => ({
  ChartImageExportButton: ({ exportId }) => (
    <button aria-label="Export chart as PNG" data-export-id={exportId} disabled type="button" />
  ),
  ScriptResultChart: ({ exportId }) => (
    <div data-export-id={exportId}>Result chart</div>
  ),
}));

class FakeEventSource {
  static CLOSED = 2;
  static instances = [];
  constructor(url) { this.url = url; this.readyState = 1; this.listeners = new Map(); FakeEventSource.instances.push(this); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  close() { this.readyState = FakeEventSource.CLOSED; }
  emit(type, data) { this.listeners.get(type)?.({ type, data }); }
}

describe("ScriptTaskConsole", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); FakeEventSource.instances = []; });

  it("renders parsed SSE events instead of raw JSON", async () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ state: "FAILED" }) })));
    render(<ScriptTaskConsole onClose={vi.fn()} task={{ taskId: "abcde-123", name: "Voltage check", state: "QUEUED" }} taskApiUrl="http://runner.test/api/scripts" />);
    const stream = FakeEventSource.instances[0];
    stream.emit("STARTED", JSON.stringify({ timestamp: "2026-07-28T08:00:00Z", data: { state: "RUNNING" } }));
    stream.emit("LOG", JSON.stringify({ timestamp: "2026-07-28T08:00:01Z", data: { level: "INFO", message: "Measurement started" } }));
    stream.emit("RECORD", JSON.stringify({ timestamp: "2026-07-28T08:00:02Z", data: { series: "Voltage", value: 12.5, unit: "V" } }));
    stream.emit("PROGRESS", JSON.stringify({ timestamp: "2026-07-28T08:00:03Z", data: { progress: 0.5 } }));
    stream.emit("FAILED", JSON.stringify({ timestamp: "2026-07-28T08:00:04Z", data: { error: { code: "TIMEOUT", message: "Device did not respond", category: "SCPI" } } }));

    await waitFor(() => expect(screen.getByText("Started")).toBeInTheDocument());
    expect(screen.getByText("abcde")).not.toHaveClass("font-mono");
    expect(screen.getByLabelText("Resize task console")).toHaveTextContent("abcde·Voltage check·FAILED");
    expect(screen.getByText("2026-07-28T08:00:00.000")).toBeInTheDocument();
    expect(screen.getByText("INFO: Measurement started")).toBeInTheDocument();
    expect(screen.getByText("Voltage: 12.5 V")).toBeInTheDocument();
    expect(screen.getByText("Progress: 50%")).toBeInTheDocument();
    expect(screen.getByText("Failed: TIMEOUT · Device did not respond · SCPI")).toBeInTheDocument();
    expect(screen.queryByText(/\{"timestamp"/)).not.toBeInTheDocument();
  });

  it("shows a console-style pending input prompt and submits its request ID and decimal value on Enter", async () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    const fetchMock = vi.fn((url, options) => options?.method === "POST"
      ? Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({ state: "RUNNING" })) })
      : Promise.resolve({ ok: true, json: () => Promise.resolve({ state: "RUNNING" }) }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ScriptTaskConsole onClose={vi.fn()} task={{ taskId: "abcde-123", name: "Current calibration", state: "RUNNING" }} taskApiUrl="http://runner.test/api/scripts" />);

    FakeEventSource.instances[0].emit("INPUT_REQUESTED", JSON.stringify({ timestamp: "2026-08-02T07:00:00Z", data: { state: "PENDING_INPUT", input: { requestId: "request-1", message: "Enter DMM current", deadline: "2026-08-02T07:05:00Z" } } }));
    expect(await screen.findByText("Enter DMM current")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Operator input value"), { target: { value: "0.0127" } });
    fireEvent.submit(screen.getByLabelText("Operator input"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "http://runner.test/api/scripts/abcde-123/input",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ requestId: "request-1", value: 0.0127 }) }),
    ));
  });

  it("submits the default value when Enter is pressed on an empty console prompt", async () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    const fetchMock = vi.fn((url, options) => options?.method === "POST"
      ? Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({ state: "RUNNING" })) })
      : Promise.resolve({ ok: true, json: () => Promise.resolve({ state: "RUNNING" }) }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ScriptTaskConsole onClose={vi.fn()} task={{ taskId: "abcde-123", name: "Input", state: "RUNNING" }} taskApiUrl="http://runner.test/api/scripts" />);

    FakeEventSource.instances[0].emit("INPUT_REQUESTED", JSON.stringify({ data: { input: { requestId: "request-default", message: "Continue", deadline: "2026-08-02T07:05:00Z" } } }));
    await screen.findByLabelText("Operator input value");
    fireEvent.submit(screen.getByLabelText("Operator input"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "http://runner.test/api/scripts/abcde-123/input",
      expect.objectContaining({ body: JSON.stringify({ requestId: "request-default", value: null }) }),
    ));
  });

  it("prints a validation error and provides a fresh console prompt", async () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ state: "RUNNING" }) }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ScriptTaskConsole onClose={vi.fn()} task={{ taskId: "abcde-123", name: "Input", state: "RUNNING" }} taskApiUrl="http://runner.test/api/scripts" />);

    FakeEventSource.instances[0].emit("INPUT_REQUESTED", JSON.stringify({ data: { input: { requestId: "request-invalid", message: "Enter value", deadline: "2026-08-02T07:05:00Z" } } }));
    const field = await screen.findByLabelText("Operator input value");
    fireEvent.change(field, { target: { value: "not-a-number" } });
    fireEvent.submit(screen.getByLabelText("Operator input"));

    expect(screen.getByText(/ERROR:/)).toBeInTheDocument();
    expect(screen.getByText(/Enter a valid decimal number\./)).toBeInTheDocument();
    expect(screen.getByLabelText("Operator input value")).toHaveValue("");
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  });

  it("loads logs and results only when their tabs are selected", async () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    const fetchMock = vi.fn((url) => url.includes("/log?")
      ? Promise.resolve({ ok: true, text: () => Promise.resolve("2026-07-28T08:00:00.000Z measurement complete") })
      : url.endsWith("abcde-123")
        ? Promise.resolve({ ok: true, json: () => Promise.resolve({ state: "RUNNING" }) })
        : Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({ finalStatus: "COMPLETED", finalProgress: 1, returnValue: { voltage: 12.5, enabled: true }, startedAt: "2026-07-28T08:00:00Z", endedAt: "2026-07-28T08:00:01Z", series: [] })) }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ScriptTaskConsole onClose={vi.fn()} task={{ taskId: "abcde-123", name: "Voltage check" }} taskApiUrl="http://runner.test/api/scripts" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("tab", { name: "Logs" }));
    const logTimestamp = await screen.findByText("2026-07-28T08:00:00.000");
    expect(fetchMock.mock.calls.find(([url]) => url.includes("/log?"))?.[0]).toContain("offset=0&limit=65536");
    expect(logTimestamp).toHaveClass("text-slate-400");
    expect(logTimestamp.parentElement).toHaveTextContent("2026-07-28T08:00:00.000 measurement complete");
    fireEvent.click(screen.getByRole("tab", { name: "Result" }));
    await waitFor(() => expect(screen.getByText("COMPLETED")).toBeInTheDocument());
    expect(screen.getByLabelText("Return value")).toHaveTextContent('"voltage": 12.5');
    expect(screen.getByText("Status")).toHaveClass("text-slate-400");
    expect(screen.getByText("2026-07-28T08:00:01.000")).not.toHaveClass("text-slate-400");
  });

  it("reports unavailable SSE for a completed task with no retained events", () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ state: "COMPLETED" }) })));

    render(<ScriptTaskConsole onClose={vi.fn()} task={{ taskId: "abcde-123", name: "Voltage check", state: "COMPLETED" }} taskApiUrl="http://runner.test/api/scripts" />);

    expect(screen.getByText("SSE not available.")).toBeInTheDocument();
  });

  it("polls logs while a non-terminal task is open on the Logs tab", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("EventSource", FakeEventSource);
    const fetchMock = vi.fn((url) => url.includes("/log?")
      ? Promise.resolve({ ok: true, text: () => Promise.resolve("first log line") })
      : Promise.resolve({ ok: true, json: () => Promise.resolve({ state: "RUNNING" }) }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ScriptTaskConsole onClose={vi.fn()} task={{ taskId: "abcde-123", name: "Voltage check", state: "RUNNING" }} taskApiUrl="http://runner.test/api/scripts" />);

    fireEvent.click(screen.getByRole("tab", { name: "Logs" }));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock.mock.calls.filter(([url]) => url.includes("/log?"))).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(3_000);
    expect(fetchMock.mock.calls.filter(([url]) => url.includes("/log?"))).toHaveLength(2);
  });

  it("fetches the result when a task reaches a terminal state", async () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    const fetchMock = vi.fn((url) => url.endsWith("/result")
      ? Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({ finalStatus: "COMPLETED" })) })
      : Promise.resolve({ ok: true, json: () => Promise.resolve({ state: "RUNNING" }) }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ScriptTaskConsole onClose={vi.fn()} task={{ taskId: "abcde-123", name: "Voltage check", state: "RUNNING" }} taskApiUrl="http://runner.test/api/scripts" />);

    FakeEventSource.instances[0].emit("COMPLETED", JSON.stringify({ timestamp: "2026-07-29T08:00:00Z", data: {} }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/result"))).toBe(true));
  });

  it("links each result series to its CSV download", async () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", vi.fn((url) => url.endsWith("/result")
      ? Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({ finalStatus: "COMPLETED", series: [{ name: "voltage" }] })) })
      : Promise.resolve({ ok: true, json: () => Promise.resolve({ state: "COMPLETED" }) })));
    render(<ScriptTaskConsole onClose={vi.fn()} task={{ taskId: "abcde-123", name: "Voltage check", state: "COMPLETED" }} taskApiUrl="http://runner.test/api/scripts" />);

    fireEvent.click(screen.getByRole("tab", { name: "Result" }));
    const link = await screen.findByRole("link", { name: "CSV" });
    expect(link).toHaveAttribute("href", "http://runner.test/api/scripts/abcde-123/series/csv?series=voltage&download=true");
    expect(link).toHaveAttribute("download");
  });

  it("opens one XL chart popup for all result series", async () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    const fetchMock = vi.fn((url) => {
      if (url.endsWith("/result")) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({ finalStatus: "COMPLETED", series: [{ name: "voltage" }, { name: "current" }] })) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ state: "COMPLETED" }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ScriptTaskConsole onClose={vi.fn()} task={{ taskId: "abcde-123", name: "Voltage check", state: "COMPLETED" }} taskApiUrl="http://runner.test/api/scripts" />);

    fireEvent.click(screen.getByRole("tab", { name: "Result" }));
    fireEvent.click(await screen.findByRole("button", { name: "Show result chart" }));

    expect(await screen.findByRole("dialog", { name: "Result chart" })).toHaveStyle({ maxWidth: "64rem" });
    expect(screen.getAllByText("Result chart")).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "CSV" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Export chart as PNG" })).toHaveAttribute("data-export-id", "script-result-chart:abcde-123");
  });

  it("retains only the latest 256 KiB of the log and downloads the full streamed log", async () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    const log = `discarded marker\n${"x".repeat(300 * 1024)}\ntail marker`;
    vi.stubGlobal("fetch", vi.fn((url) => url.includes("/log?")
      ? Promise.resolve({ ok: true, text: () => Promise.resolve(log) })
      : Promise.resolve({ ok: true, json: () => Promise.resolve({ state: "COMPLETED" }) })));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    let downloadLink;
    const append = vi.spyOn(document.body, "append").mockImplementation((node) => { downloadLink = node; });
    render(<ScriptTaskConsole onClose={vi.fn()} task={{ taskId: "abcde-123", name: "Voltage check", state: "COMPLETED" }} taskApiUrl="http://runner.test/api/scripts" />);

    fireEvent.click(screen.getByRole("tab", { name: "Logs" }));
    const tail = await screen.findByText(/tail marker/);
    expect(tail.closest("pre").textContent.length).toBeLessThanOrEqual(256 * 1024);
    expect(screen.queryByText(/discarded marker/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(downloadLink.href).toMatch(/\/api\/scripts\/abcde-123\/log\?download=true&downloadName=log_abcde-Voltage_check_.*\.txt/);
    expect(downloadLink.download).toMatch(/^log_abcde-Voltage_check_.*\.txt$/);
    expect(click).toHaveBeenCalledOnce();
    append.mockRestore();
  });

  it("resizes from its header while preserving its 128 px minimum height", () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ state: "RUNNING" }) })));
    render(<ScriptTaskConsole onClose={vi.fn()} task={{ taskId: "abcde-123", name: "Voltage check" }} taskApiUrl="http://runner.test/api/scripts" />);
    const console = screen.getByLabelText("Script task console");
    fireEvent.pointerDown(screen.getByLabelText("Resize task console"), { clientY: 500 });
    fireEvent.pointerMove(window, { clientY: 400 });
    expect(console.parentElement).toHaveStyle({ height: "356px" });
    fireEvent.pointerMove(window, { clientY: 900 });
    expect(console.parentElement).toHaveStyle({ height: "128px" });
  });
});
