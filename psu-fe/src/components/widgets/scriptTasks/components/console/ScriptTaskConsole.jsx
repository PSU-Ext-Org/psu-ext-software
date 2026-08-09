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
import { Settings } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { LogOverlayActions } from "../../../../layout/monitor/LogOverlayActions.jsx";
import { Modal } from "../../../../layout/dialogs/Modal.jsx";
import { ScriptResultChart } from "../../../chart/index.js";
import { TaskConsoleTabs } from "./TaskConsoleTabs.jsx";
import { TaskConsoleHeader } from "./TaskConsoleHeader.jsx";

const EVENT_TYPES = ["STARTED", "INPUT_REQUESTED", "INPUT_RESOLVED", "CANCELLING", "LOG", "RECORD", "PROGRESS", "COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"];
const TERMINAL_TYPES = new Set(["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"]);
const ISO_TIMESTAMP_PATTERN = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))/g;
const MIN_PANE_HEIGHT = 128;
const DEFAULT_PANE_HEIGHT = 256;
const LOG_REFRESH_INTERVAL = 3_000;
const LOG_PAGE_LIMIT = 64 * 1024;
const MAX_LOG_BYTES = 256 * 1024;
const MAX_SSE_BYTES = 256 * 1024;
const textEncoder = new TextEncoder();

/**
 * Bottom-panel console for one Script Runner task.
 *
 * @param {object} props
 * @param {() => void} props.onClose Hides the console.
 * @param {{taskId: string, name?: string, state?: string}} props.task Selected task summary.
 * @param {string} props.taskApiUrl Script task API base URL.
 * @returns {import("react").ReactElement}
 */
export function ScriptTaskConsole({ onClose, task, taskApiUrl }) {
  const [tab, setTab] = useState("sse");
  const [events, setEvents] = useState([]);
  const [streamError, setStreamError] = useState("");
  const [log, setLog] = useState({ status: "idle", value: "", error: "" });
  const [result, setResult] = useState({ status: "idle", value: null, error: "", signature: "" });
  const [status, setStatus] = useState(task.state || "QUEUED");
  const [pendingInput, setPendingInput] = useState(null);
  const [chartSeries, setChartSeries] = useState([]);
  const [chartSettingsOpen, setChartSettingsOpen] = useState(false);
  const [height, setHeight] = useState(DEFAULT_PANE_HEIGHT);
  const drag = useRef(null);
  const statusRequest = useRef(0);
  const nextLogOffset = useRef(0);
  const logRequestInFlight = useRef(false);
  const outputRef = useRef(null);

  function scrollConsoleToBottom() {
    window.requestAnimationFrame(() => {
      if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
    });
  }

  useEffect(() => {
    function resize(event) {
      if (!drag.current) return;
      const maximum = Math.max(MIN_PANE_HEIGHT, window.innerHeight - 228);
      setHeight(Math.min(maximum, Math.max(MIN_PANE_HEIGHT, drag.current.height + drag.current.y - event.clientY)));
    }
    function stopResize() { drag.current = null; }
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stopResize);
    return () => {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stopResize);
    };
  }, []);

  useEffect(() => {
    setTab("sse");
    setEvents([]);
    setStreamError("");
    setLog({ status: "idle", value: "", error: "" });
    setResult({ status: "idle", value: null, error: "", signature: "" });
    setStatus(task.state || "QUEUED");
    setPendingInput(null);
    setChartSeries([]);
    setChartSettingsOpen(false);
    nextLogOffset.current = 0;
    logRequestInFlight.current = false;
    let active = true;
    const statusUrl = `${taskApiUrl}/${encodeURIComponent(task.taskId)}`;
    function refreshStatus() {
      const request = ++statusRequest.current;
      fetch(statusUrl, { headers: { Accept: "application/json" } })
        .then((response) => response.ok ? response.json() : null)
        .then((snapshot) => {
          if (active && request === statusRequest.current && snapshot?.state) {
            updateStatus(setStatus, snapshot.state);
            if (snapshot.pendingInput) setPendingInput(snapshot.pendingInput);
          }
        })
        .catch(() => {});
    }
    refreshStatus();
    const stream = new EventSource(`${taskApiUrl}/${encodeURIComponent(task.taskId)}/events`);
    const append = (event) => {
      const parsed = parseEvent(event);
      if (parsed) setEvents((current) => retainRecentEvents([...current, parsed]));
      updateStatus(setStatus, parsed?.data?.state || taskStateForEvent(event.type));
      if (event.type === "INPUT_REQUESTED") setPendingInput(parsed?.data?.input || null);
      if (event.type === "INPUT_RESOLVED") setPendingInput(null);
      refreshStatus();
      if (TERMINAL_TYPES.has(event.type)) stream.close();
    };
    EVENT_TYPES.forEach((type) => stream.addEventListener(type, append));
    stream.onerror = () => {
      if (stream.readyState === EventSource.CLOSED) setStreamError("SSE connection closed.");
    };
    return () => { active = false; stream.close(); };
  }, [task.state, task.taskId, taskApiUrl]);

  useEffect(() => {
    if ((tab === "sse" || tab === "logs") && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [events, log.value, tab]);

  useEffect(() => {
    if (tab !== "logs") return undefined;
    let active = true;
    const logUrl = `${taskApiUrl}/${encodeURIComponent(task.taskId)}/log`;
    function refreshLog() {
      if (logRequestInFlight.current) return;
      logRequestInFlight.current = true;
      const offset = nextLogOffset.current;
      setLog((current) => {
        const nextStatus = current.value ? "ready" : "loading";
        return current.status === nextStatus && !current.error ? current : { ...current, status: nextStatus, error: "" };
      });
      fetch(`${logUrl}?offset=${offset}&limit=${LOG_PAGE_LIMIT}`, { headers: { Accept: "text/plain" } })
        .then(async (response) => response.ok ? response.text() : Promise.reject(new Error(`Log unavailable (HTTP ${response.status}).`)))
        .then((value) => {
          if (!active) return;
          nextLogOffset.current += value.length;
          setLog((current) => {
            const nextValue = retainRecentText(current.value + value, MAX_LOG_BYTES);
            return current.status === "ready" && current.value === nextValue && !current.error
              ? current
              : { status: "ready", value: nextValue, error: "" };
          });
        })
        .catch((error) => {
          if (!active) return;
          const message = error.message || "Could not load task log.";
          setLog((current) => current.status === "error" && current.error === message
            ? current
            : { ...current, status: "error", error: message });
        })
        .finally(() => { logRequestInFlight.current = false; });
    }
    refreshLog();
    const interval = TERMINAL_TYPES.has(status) ? null : window.setInterval(refreshLog, LOG_REFRESH_INTERVAL);
    return () => {
      active = false;
      if (interval !== null) window.clearInterval(interval);
    };
  }, [status, tab, task.taskId, taskApiUrl]);

  useEffect(() => {
    if (tab !== "result" && !TERMINAL_TYPES.has(status)) return undefined;
    let active = true;
    setResult((current) => {
      const nextStatus = current.value ? "ready" : "loading";
      return current.status === nextStatus && !current.error ? current : { ...current, status: nextStatus, error: "" };
    });
    fetch(`${taskApiUrl}/${encodeURIComponent(task.taskId)}/result`, { headers: { Accept: "application/json" } })
      .then(async (response) => {
        const text = await response.text();
        const value = text ? JSON.parse(text) : null;
        if (!response.ok) throw new Error(value?.message || `Result unavailable (HTTP ${response.status}).`);
        return { signature: text, value };
      })
      .then(({ signature, value }) => {
        if (active) setResult((current) => current.status === "ready" && current.signature === signature && !current.error
          ? current
          : { status: "ready", value, error: "", signature });
      })
      .catch((error) => {
        if (!active) return;
        const message = error.message || "Could not load task result.";
        setResult((current) => current.status === "error" && current.error === message
          ? current
          : { ...current, status: "error", error: message });
      });
    return () => { active = false; };
  }, [status, tab, task.taskId, taskApiUrl]);

  return (
    <>
      <div className="mt-3 shrink-0" style={{ height }}>
      <section aria-label="Script task console" className="flex h-full flex-col overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
      <TaskConsoleHeader drag={drag} height={height} name={task.name} onClose={onClose} status={status} taskId={task.taskId} />
      <TaskConsoleTabs
        activeId={tab}
        onSelect={setTab}
        tabs={[
          { id: "sse", label: "SSE" },
          { id: "logs", label: "Logs" },
          { id: "result", label: "Result" },
        ]}
      />
      <div aria-label="Task console output" className="relative min-h-0 flex-1 overflow-auto bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100" ref={outputRef}>
        {tab === "sse" ? <SseEvents events={events} error={streamError} pendingInput={pendingInput} status={status} task={task} taskApiUrl={taskApiUrl} onInputResolved={() => setPendingInput(null)} onInputSubmitted={scrollConsoleToBottom} /> : null}
        {tab === "logs" ? <LogView log={log} onDownload={() => downloadLog(taskApiUrl, task)} /> : null}
        {tab === "result" ? <ResultView onShowChart={setChartSeries} result={result} task={task} taskApiUrl={taskApiUrl} /> : null}
      </div>
      </section>
      </div>
      {chartSeries.length ? (
        <Modal dialogClassName="h-[min(42rem,calc(100dvh-2rem))]" fill size="xl" title={<ResultChartTitle onConfigure={() => setChartSettingsOpen(true)} />} onClose={() => { setChartSettingsOpen(false); setChartSeries([]); }}>
          <ScriptResultChart onSettingsOpenChange={setChartSettingsOpen} seriesNames={chartSeries} settingsOpen={chartSettingsOpen} taskApiUrl={taskApiUrl} taskId={task.taskId} />
        </Modal>
      ) : null}
    </>
  );
}

function ResultChartTitle({ onConfigure }) {
  return (
    <span className="inline-flex h-6 items-center gap-1">
      <span>Result chart</span>
      <button aria-label="Configure result chart statistics" className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700" onClick={onConfigure} type="button">
        <Settings className="h-4 w-4" />
      </button>
    </span>
  );
}

function SseEvents({ error, events, onInputResolved, onInputSubmitted, pendingInput, status, task, taskApiUrl }) {
  return <>{!events.length && !error && !pendingInput ? <p className="text-slate-400">{TERMINAL_TYPES.has(status) ? "SSE not available." : "Waiting for task events…"}</p> : null}{events.map((event, index) => <div className="grid grid-cols-[auto_1fr] gap-x-3" key={`${event.sequence || index}-${event.type}`}><time className="text-slate-400">{formatTime(event.timestamp)}</time><span>{formatEvent(event)}</span></div>)}{pendingInput ? <InputPrompt input={pendingInput} onResolved={onInputResolved} onSubmitted={onInputSubmitted} task={task} taskApiUrl={taskApiUrl} /> : null}{error ? <p className="mt-2 text-amber-300">{error}</p> : null}</>;
}

function InputPrompt({ input, onResolved, onSubmitted, task, taskApiUrl }) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rejectedEntries, setRejectedEntries] = useState([]);
  useEffect(() => { setValue(""); setSubmitting(false); setRejectedEntries([]); }, [input.requestId]);
  function reject(message) {
    setRejectedEntries((entries) => [...entries, { value, message, timestamp: new Date().toISOString() }]);
    setValue("");
    setSubmitting(false);
    onSubmitted();
  }
  async function submit() {
    const parsed = !value.trim() ? null : Number(value);
    if (parsed !== null && !Number.isFinite(parsed)) { reject("Enter a valid decimal number."); return; }
    setSubmitting(true);
    try {
      const response = await fetch(`${taskApiUrl}/${encodeURIComponent(task.taskId)}/input`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: input.requestId, value: parsed }),
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(body?.message || `Input submission failed (HTTP ${response.status}).`);
      onResolved();
      onSubmitted();
    } catch (requestError) { reject(requestError.message || "Could not submit input."); }
    finally { setSubmitting(false); }
  }
  return <form aria-label="Operator input" onSubmit={(event) => { event.preventDefault(); submit(); }}><div className="grid grid-cols-[auto_1fr] gap-x-3"><time className="text-slate-400">{formatTime(input.deadline)}</time><span>{input.message}</span>{rejectedEntries.map((entry, index) => <div className="contents" key={`${entry.value}-${index}`}><time className="text-slate-400">{formatTime(entry.timestamp)}</time><span><span className="text-teal-300">&gt;</span> {entry.value}</span><time className="text-slate-400">{formatTime(entry.timestamp)}</time><span className="text-rose-300">ERROR: {entry.message}</span></div>)}<span className="text-teal-300">&gt;</span><input aria-label="Operator input value" autoFocus className="min-w-0 bg-transparent text-slate-100 outline-none placeholder:text-slate-500" disabled={submitting} inputMode="decimal" onChange={(event) => setValue(event.target.value)} placeholder={submitting ? "Submitting…" : "Enter value, or press Enter for 1"} value={value} /></div></form>;
}

function LogView({ log, onDownload }) {
  if (log.status === "idle" || log.status === "loading") return <p className="text-slate-400">Loading task log…</p>;
  return <><LogOverlayActions byteLength={byteLength(log.value)} onDownload={onDownload} sticky />{log.status === "error" ? <p className="text-rose-300">{log.error}</p> : log.value ? <pre className="whitespace-pre-wrap"><LogText value={log.value} /></pre> : <p className="text-slate-400">No task log was recorded.</p>}</>;
}

function LogText({ value }) {
  return value.split(ISO_TIMESTAMP_PATTERN).map((part, index) => index % 2 ? <span className="text-slate-400" key={`${part}-${index}`}>{formatTime(part)}</span> : part);
}

const ResultView = memo(function ResultView({ onShowChart, result, task, taskApiUrl }) {
  if (result.status === "idle" || result.status === "loading") return <p className="text-slate-400">Loading task result…</p>;
  if (result.status === "error") return <p className="text-amber-300">{result.error}</p>;
  const value = result.value;
  const seriesNames = value.series?.map((series) => series.name || series.series || "").filter(Boolean) || [];
  return <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1"><dt className="text-slate-400">Status</dt><dd>{value.finalStatus}</dd><dt className="text-slate-400">Progress</dt><dd>{value.finalProgress == null ? "—" : `${Math.round(value.finalProgress * 100)}%`}</dd><dt className="text-slate-400">Started</dt><dd>{formatTime(value.startedAt)}</dd><dt className="text-slate-400">Ended</dt><dd>{formatTime(value.endedAt)}</dd>{value.error ? <><dt className="text-rose-300">Error</dt><dd className="text-rose-200">{formatError(value.error)}</dd></> : null}{seriesNames.length ? <><dt className="text-slate-400">Series</dt><dd>{seriesNames.map((name, index) => <span key={name}>{index ? ", " : ""}{name} <a className="text-teal-300 underline hover:text-teal-200" download href={seriesCsvUrl(taskApiUrl, task.taskId, name)}>CSV</a></span>)} <button aria-label="Show result chart" className="text-teal-300 underline hover:text-teal-200" onClick={() => onShowChart(seriesNames)} type="button">Chart</button></dd></> : null}<dt className="text-slate-400">Return value</dt><dd className="min-w-0"><pre aria-label="Return value" className="whitespace-pre-wrap break-all">{formatValue(value.returnValue)}</pre></dd></dl>;
});

function parseEvent(event) {
  try {
    const envelope = JSON.parse(event.data);
    return { ...envelope, type: event.type, data: envelope.data || envelope };
  } catch {
    return null;
  }
}

function formatEvent(event) {
  const data = event.data || {};
  if (event.type === "LOG") return `${data.level || "INFO"}: ${data.message || "Log message"}`;
  if (event.type === "RECORD") return `${data.series || "Record"}: ${data.value}${data.unit ? ` ${data.unit}` : ""}`;
  if (event.type === "PROGRESS") return `Progress: ${Math.round((data.progress || 0) * 100)}%`;
  if (event.type === "STARTED") return "Started";
  if (event.type === "INPUT_REQUESTED") return `Waiting for input: ${data.input?.message || "Operator input requested"}`;
  if (event.type === "INPUT_RESOLVED") return "Operator input resolved";
  if (event.type === "CANCELLING") return "Cancelling";
  if (event.type === "COMPLETED") return "Completed";
  return `${sentence(event.type)}: ${formatError(data.error)}`;
}

function formatError(error) { return error ? [error.code, error.message, error.category].filter(Boolean).join(" · ") : "No error details supplied"; }
function byteLength(value) { return textEncoder.encode(value).byteLength; }
function retainRecentText(value, maximumBytes) {
  if (byteLength(value) <= maximumBytes) return value;
  let low = 0;
  let high = value.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (byteLength(value.slice(middle)) <= maximumBytes) high = middle;
    else low = middle + 1;
  }
  return value.slice(low);
}
function retainRecentEvents(events) {
  let bytes = 0;
  const retained = [];
  for (let index = events.length - 1; index >= 0; index--) {
    const event = compactEvent(events[index]);
    const eventBytes = byteLength(JSON.stringify(event));
    if (bytes + eventBytes > MAX_SSE_BYTES) break;
    bytes += eventBytes;
    retained.unshift(event);
  }
  return retained;
}
function compactEvent(event) {
  if (byteLength(JSON.stringify(event)) <= MAX_SSE_BYTES) return event;
  return {
    type: event.type,
    timestamp: event.timestamp,
    sequence: event.sequence,
    data: { message: "Event payload exceeded the 256 KB console limit and was truncated." },
  };
}
function downloadLog(taskApiUrl, task) {
  const fileName = logDownloadName(task);
  const link = document.createElement("a");
  link.href = `${taskApiUrl}/${encodeURIComponent(task.taskId)}/log?download=true&downloadName=${encodeURIComponent(fileName)}`;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
}
function seriesCsvUrl(taskApiUrl, taskId, seriesName) { return `${taskApiUrl}/${encodeURIComponent(taskId)}/series/csv?series=${encodeURIComponent(seriesName)}&download=true`; }
function logDownloadName(task) {
  const name = String(task.name || "task")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_") || "task";
  const shortId = String(task.taskId).slice(0, 5);
  const date = new Date().toISOString().replace(/\.\d{3}Z$/, "").replace(/:/g, "-");
  return `log_${shortId}-${name}_${date}.txt`;
}
function taskStateForEvent(type) { return ["STARTED", "INPUT_REQUESTED", "INPUT_RESOLVED", "CANCELLING", "COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"].includes(type) ? type === "STARTED" || type === "INPUT_RESOLVED" ? "RUNNING" : type === "INPUT_REQUESTED" ? "PENDING_INPUT" : type : ""; }
async function readJson(response) { const text = await response.text(); try { return text ? JSON.parse(text) : null; } catch { return { message: text }; } }
function updateStatus(setStatus, nextStatus) {
  if (!nextStatus) return;
  setStatus((current) => current === nextStatus ? current : nextStatus);
}
function sentence(value) { return String(value || "Event").toLowerCase().replace(/(^|_)([a-z])/g, (_, prefix, letter) => `${prefix ? " " : ""}${letter.toUpperCase()}`); }
function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? String(value) : date.toISOString().replace("Z", "");
}
function formatValue(value) {
  if (value === undefined) return "Unavailable";
  return typeof value === "object" ? JSON.stringify(value, null, 2) : JSON.stringify(value);
}
