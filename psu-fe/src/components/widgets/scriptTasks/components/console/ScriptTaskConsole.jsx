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
import { useEffect, useRef, useState } from "react";
import { ScriptResultChartModal } from "./ScriptResultChartModal.jsx";
import { LogView, ResultView, SseEvents } from "./ScriptTaskConsoleViews.jsx";
import { TaskConsoleTabs } from "./TaskConsoleTabs.jsx";
import { TaskConsoleHeader } from "./TaskConsoleHeader.jsx";

const EVENT_TYPES = ["STARTED", "INPUT_REQUESTED", "INPUT_RESOLVED", "CANCELLING", "LOG", "RECORD", "PROGRESS", "COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"];
const TERMINAL_TYPES = new Set(["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"]);
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

  function closeResultChart() {
    setChartSettingsOpen(false);
    setChartSeries([]);
  }

  function resolvePendingInput() {
    setPendingInput(null);
  }

  function downloadCurrentLog() {
    downloadLog(taskApiUrl, task);
  }

  return (
    <>
      <div className="mt-3 shrink-0" style={{ height }}>
        <section aria-label="Script task console" className="flex h-full flex-col overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
          <TaskConsoleHeader
            drag={drag}
            height={height}
            name={task.name}
            onClose={onClose}
            status={status}
            taskId={task.taskId}
          />
          <TaskConsoleTabs
            activeId={tab}
            onSelect={setTab}
            tabs={[
              { id: "sse", label: "SSE" },
              { id: "logs", label: "Logs" },
              { id: "result", label: "Result" },
            ]}
          />
          <div
            aria-label="Task console output"
            className="relative min-h-0 flex-1 overflow-auto bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100"
            ref={outputRef}
          >
            {tab === "sse" ? (
              <SseEvents
                error={streamError}
                events={events}
                onInputResolved={resolvePendingInput}
                onInputSubmitted={scrollConsoleToBottom}
                pendingInput={pendingInput}
                status={status}
                task={task}
                taskApiUrl={taskApiUrl}
              />
            ) : null}
            {tab === "logs" ? <LogView log={log} onDownload={downloadCurrentLog} /> : null}
            {tab === "result" ? (
              <ResultView
                onShowChart={setChartSeries}
                result={result}
                task={task}
                taskApiUrl={taskApiUrl}
              />
            ) : null}
          </div>
        </section>
      </div>
      {chartSeries.length ? (
        <ScriptResultChartModal
          onClose={closeResultChart}
          onSettingsOpenChange={setChartSettingsOpen}
          seriesNames={chartSeries}
          settingsOpen={chartSettingsOpen}
          taskApiUrl={taskApiUrl}
          taskId={task.taskId}
        />
      ) : null}
    </>
  );
}

function parseEvent(event) {
  try {
    const envelope = JSON.parse(event.data);
    return { ...envelope, type: event.type, data: envelope.data || envelope };
  } catch {
    return null;
  }
}

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
function updateStatus(setStatus, nextStatus) {
  if (!nextStatus) return;
  setStatus((current) => current === nextStatus ? current : nextStatus);
}
