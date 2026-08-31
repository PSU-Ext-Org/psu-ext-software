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
import { memo, useEffect, useState } from "react";
import { LogOverlayActions } from "../../../../layout/monitor/LogOverlayActions.jsx";

const TERMINAL_TYPES = new Set(["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"]);
const ISO_TIMESTAMP_PATTERN = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))/g;
const textEncoder = new TextEncoder();

/**
 * Displays retained task events and any active operator-input prompt.
 *
 * @param {object} props
 * @param {string} props.error - Current SSE connection error.
 * @param {Array<object>} props.events - Parsed task event envelopes.
 * @param {() => void} props.onInputResolved - Clears a completed input request.
 * @param {() => void} props.onInputSubmitted - Restores console scroll position.
 * @param {object | null} props.pendingInput - Active operator-input request.
 * @param {string} props.status - Current task status.
 * @param {{taskId: string}} props.task - Task that owns the event stream.
 * @param {string} props.taskApiUrl - Script Runner task API base URL.
 * @returns {import("react").ReactElement}
 */
export function SseEvents({
  error,
  events,
  onInputResolved,
  onInputSubmitted,
  pendingInput,
  status,
  task,
  taskApiUrl,
}) {
  const showEmptyState = !events.length && !error && !pendingInput;

  return (
    <>
      {showEmptyState ? (
        <p className="text-slate-400">
          {TERMINAL_TYPES.has(status) ? "SSE not available." : "Waiting for task events…"}
        </p>
      ) : null}
      {events.map((event, index) => (
        <div className="grid grid-cols-[auto_1fr] gap-x-3" key={`${event.sequence || index}-${event.type}`}>
          <time className="text-slate-400">{formatTime(event.timestamp)}</time>
          <span>{formatEvent(event)}</span>
        </div>
      ))}
      {pendingInput ? (
        <InputPrompt
          input={pendingInput}
          onResolved={onInputResolved}
          onSubmitted={onInputSubmitted}
          task={task}
          taskApiUrl={taskApiUrl}
        />
      ) : null}
      {error ? <p className="mt-2 text-amber-300">{error}</p> : null}
    </>
  );
}

function InputPrompt({ input, onResolved, onSubmitted, task, taskApiUrl }) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rejectedEntries, setRejectedEntries] = useState([]);

  useEffect(() => {
    setValue("");
    setSubmitting(false);
    setRejectedEntries([]);
  }, [input.requestId]);

  function reject(message) {
    setRejectedEntries((entries) => [
      ...entries,
      { value, message, timestamp: new Date().toISOString() },
    ]);
    setValue("");
    setSubmitting(false);
    onSubmitted();
  }

  async function submit() {
    const parsed = !value.trim() ? null : Number(value);
    if (parsed !== null && !Number.isFinite(parsed)) {
      reject("Enter a valid decimal number.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${taskApiUrl}/${encodeURIComponent(task.taskId)}/input`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: input.requestId, value: parsed }),
      });
      const body = await readJson(response);
      if (!response.ok) {
        throw new Error(body?.message || `Input submission failed (HTTP ${response.status}).`);
      }
      onResolved();
      onSubmitted();
    } catch (requestError) {
      reject(requestError.message || "Could not submit input.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    submit();
  }

  return (
    <form aria-label="Operator input" onSubmit={handleSubmit}>
      <div className="grid grid-cols-[auto_1fr] gap-x-3">
        <time className="text-slate-400">{formatTime(input.deadline)}</time>
        <span>{input.message}</span>
        {rejectedEntries.map((entry, index) => (
          <div className="contents" key={`${entry.value}-${index}`}>
            <time className="text-slate-400">{formatTime(entry.timestamp)}</time>
            <span>
              <span className="text-teal-300">&gt;</span> {entry.value}
            </span>
            <time className="text-slate-400">{formatTime(entry.timestamp)}</time>
            <span className="text-rose-300">ERROR: {entry.message}</span>
          </div>
        ))}
        <span className="text-teal-300">&gt;</span>
        <input
          aria-label="Operator input value"
          autoFocus
          className="min-w-0 bg-transparent text-slate-100 outline-none placeholder:text-slate-500"
          disabled={submitting}
          inputMode="decimal"
          onChange={(event) => setValue(event.target.value)}
          placeholder={submitting ? "Submitting…" : "Enter value, or press Enter for 1"}
          value={value}
        />
      </div>
    </form>
  );
}

/**
 * Displays a task log with download controls and readable timestamps.
 *
 * @param {object} props
 * @param {{status: string, value: string, error: string}} props.log - Current retained log state.
 * @param {() => void} props.onDownload - Starts the complete log download.
 * @returns {import("react").ReactElement}
 */
export function LogView({ log, onDownload }) {
  if (log.status === "idle" || log.status === "loading") {
    return <p className="text-slate-400">Loading task log…</p>;
  }

  return (
    <>
      <LogOverlayActions byteLength={byteLength(log.value)} onDownload={onDownload} sticky />
      {log.status === "error" ? <p className="text-rose-300">{log.error}</p> : null}
      {log.status !== "error" && log.value ? (
        <pre className="whitespace-pre-wrap">
          <LogText value={log.value} />
        </pre>
      ) : null}
      {log.status !== "error" && !log.value ? (
        <p className="text-slate-400">No task log was recorded.</p>
      ) : null}
    </>
  );
}

function LogText({ value }) {
  return value.split(ISO_TIMESTAMP_PATTERN).map((part, index) => (
    index % 2
      ? <span className="text-slate-400" key={`${part}-${index}`}>{formatTime(part)}</span>
      : part
  ));
}

/**
 * Displays a completed task result and actions for downloadable or chartable series.
 *
 * @param {object} props
 * @param {(seriesNames: string[]) => void} props.onShowChart - Opens selected result series.
 * @param {{status: string, value: object | null, error: string}} props.result - Loaded task result state.
 * @param {{taskId: string}} props.task - Task that owns the result.
 * @param {string} props.taskApiUrl - Script Runner task API base URL.
 * @returns {import("react").ReactElement}
 */
export const ResultView = memo(function ResultView({ onShowChart, result, task, taskApiUrl }) {
  if (result.status === "idle" || result.status === "loading") {
    return <p className="text-slate-400">Loading task result…</p>;
  }
  if (result.status === "error") {
    return <p className="text-amber-300">{result.error}</p>;
  }

  const value = result.value;
  const seriesNames = value.series?.map((series) => series.name || series.series || "").filter(Boolean) || [];

  function showChart() {
    onShowChart(seriesNames);
  }

  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
      <dt className="text-slate-400">Status</dt>
      <dd>{value.finalStatus}</dd>
      <dt className="text-slate-400">Progress</dt>
      <dd>{value.finalProgress == null ? "—" : `${Math.round(value.finalProgress * 100)}%`}</dd>
      <dt className="text-slate-400">Started</dt>
      <dd>{formatTime(value.startedAt)}</dd>
      <dt className="text-slate-400">Ended</dt>
      <dd>{formatTime(value.endedAt)}</dd>
      {value.error ? (
        <>
          <dt className="text-rose-300">Error</dt>
          <dd className="text-rose-200">{formatError(value.error)}</dd>
        </>
      ) : null}
      {seriesNames.length ? (
        <>
          <dt className="text-slate-400">Series</dt>
          <dd>
            {seriesNames.map((name, index) => (
              <span key={name}>
                {index ? ", " : ""}{name}{" "}
                <a
                  className="text-teal-300 underline hover:text-teal-200"
                  download
                  href={seriesCsvUrl(taskApiUrl, task.taskId, name)}
                >
                  CSV
                </a>
              </span>
            ))}{" "}
            <button
              aria-label="Show result chart"
              className="text-teal-300 underline hover:text-teal-200"
              onClick={showChart}
              type="button"
            >
              Chart
            </button>
          </dd>
        </>
      ) : null}
      <dt className="text-slate-400">Return value</dt>
      <dd className="min-w-0">
        <pre aria-label="Return value" className="whitespace-pre-wrap break-all">
          {formatValue(value.returnValue)}
        </pre>
      </dd>
    </dl>
  );
});

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

function formatError(error) {
  return error
    ? [error.code, error.message, error.category].filter(Boolean).join(" · ")
    : "No error details supplied";
}

function byteLength(value) {
  return textEncoder.encode(value).byteLength;
}

function seriesCsvUrl(taskApiUrl, taskId, seriesName) {
  return `${taskApiUrl}/${encodeURIComponent(taskId)}/series/csv?series=${encodeURIComponent(seriesName)}&download=true`;
}

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { message: text };
  }
}

function sentence(value) {
  return String(value || "Event")
    .toLowerCase()
    .replace(/(^|_)([a-z])/g, (_, prefix, letter) => `${prefix ? " " : ""}${letter.toUpperCase()}`);
}

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? String(value) : date.toISOString().replace("Z", "");
}

function formatValue(value) {
  if (value === undefined) return "Unavailable";
  return typeof value === "object" ? JSON.stringify(value, null, 2) : JSON.stringify(value);
}
