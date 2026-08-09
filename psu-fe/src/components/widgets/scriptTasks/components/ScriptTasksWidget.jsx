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
import { ChevronDown, RefreshCw, SquareX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useScriptRunnerHttp } from "../../../../connection/http-script/ScriptRunnerHttpContext.jsx";
import { Modal } from "../../../layout/dialogs/Modal.jsx";
import { Pagination } from "../../../ui/Pagination.jsx";

const CANCEL_EVENT = "psu-ext-open-script-task-cancel";
const REFRESH_EVENT = "psu-ext-refresh-script-tasks";
const SELECTION_EVENT = "psu-ext-script-task-selection";
const PAGE_SIZE = 10;
const TERMINAL_STATES = new Set(["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT", "INTERRUPTED"]);

/** Header actions for cancelling selected active script tasks. */
export function ScriptTasksActions() {
  const [open, setOpen] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const menuRef = useRef(null);

  useEffect(() => {
    const update = (event) => setSelectedCount(event.detail);
    window.addEventListener(SELECTION_EVENT, update);
    return () => window.removeEventListener(SELECTION_EVENT, update);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    function closeOnOutsidePointerDown(event) {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [open]);

  function requestCancel() {
    setOpen(false);
    window.dispatchEvent(new Event(CANCEL_EVENT));
  }

  function requestRefresh() {
    setOpen(false);
    window.dispatchEvent(new Event(REFRESH_EVENT));
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="control-standard inline-flex items-center gap-2 bg-teal-700 px-3 font-medium text-white hover:bg-teal-800"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        Actions
        <ChevronDown className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 z-10 mt-1 grid min-w-28 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg" role="menu">
          <button
            className="inline-flex items-center gap-2 px-3 py-1.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={requestRefresh}
            role="menuitem"
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            className="inline-flex items-center gap-2 px-3 py-1.5 text-left text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            disabled={!selectedCount}
            onClick={requestCancel}
            role="menuitem"
            type="button"
          >
            <SquareX className="h-4 w-4" />
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * All-status Script Runner task history with manual refresh and cancellation.
 *
 * @param {object} props
 * @param {(task: object) => void} [props.onOpenTask] Opens a task in the IDE console.
 * @returns {import("react").ReactElement}
 */
export function ScriptTasksWidget({ actions, onOpenTask }) {
  const { scriptTaskApiUrl } = useScriptRunnerHttp();
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState(emptyPage);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [cancelTasks, setCancelTasks] = useState(null);
  const [cancelError, setCancelError] = useState("");
  const inFlightRequest = useRef("");

  async function load() {
    const requestKey = `${scriptTaskApiUrl}?limit=${PAGE_SIZE}&offset=${offset}`;
    if (inFlightRequest.current === requestKey) return;
    inFlightRequest.current = requestKey;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(requestKey, {
        headers: { Accept: "application/json" },
      });
      const payload = await readResponse(response);
      if (!response.ok) throw new Error(payload?.message || `Request failed (${response.status}).`);
      setPage(normalisePage(payload));
    } catch (requestError) {
      setPage(emptyPage());
      setError(requestError.message || "Failed to fetch.");
    } finally {
      setLoading(false);
      if (inFlightRequest.current === requestKey) inFlightRequest.current = "";
    }
  }

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 5_000);
    return () => window.clearInterval(interval);
  }, [scriptTaskApiUrl, offset]);
  useEffect(() => { window.dispatchEvent(new CustomEvent(SELECTION_EVENT, { detail: selectedIds.size })); }, [selectedIds]);
  useEffect(() => { setOffset(0); setSelectedIds(new Set()); }, [scriptTaskApiUrl]);

  const label = useMemo(() => page.total
    ? `${page.offset + 1}–${Math.min(page.offset + page.items.length, page.total)} of ${page.total}`
    : "No script tasks", [page]);
  const selectedTasks = page.items.filter((task) => selectedIds.has(task.taskId));

  async function cancelSelected() {
    setCancelError("");
    try {
      await Promise.all(cancelTasks.map((task) => cancelTask(scriptTaskApiUrl, task)));
      setSelectedIds(new Set());
      setCancelTasks(null);
      load();
    } catch (requestError) {
      setCancelError(requestError.message || "Could not cancel selected tasks.");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {actions ? <div className="flex shrink-0 justify-end">{actions}</div> : null}
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">Script Runner unavailable at {scriptTaskApiUrl}: {error}</p> : null}
      <TaskTable items={page.items} loading={loading} onOpen={onOpenTask} selectedIds={selectedIds} onSelect={(id, selected) => setSelectedIds((current) => updateSelection(current, id, selected))} />
      <Pagination label={label} canNext={page.offset + page.items.length < page.total} canPrevious={page.offset > 0} onNext={() => setOffset(page.offset + page.limit)} onPrevious={() => setOffset(Math.max(0, page.offset - page.limit))} />
      {cancelTasks ? <CancelTasksModal error={cancelError} onCancel={cancelSelected} onClose={() => setCancelTasks(null)} tasks={cancelTasks} /> : null}
      <ScriptTaskActionListener
        onCancel={() => selectedTasks.length && setCancelTasks(selectedTasks)}
        onRefresh={load}
      />
    </div>
  );
}

function TaskTable({ items, loading, onOpen, selectedIds, onSelect }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-md border border-slate-200">
      <table className="w-full table-fixed text-left text-sm">
        <colgroup><col className="w-14" /><col className="w-28" /><col className="w-48" /><col className="w-28" /><col className="w-24" /><col className="w-40" /><col className="w-40" /></colgroup>
        <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Select</th><th className="px-3 py-2">ID</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">State</th><th className="px-3 py-2">Progress</th><th className="px-3 py-2">Created</th><th className="px-3 py-2">Ended</th></tr></thead>
        <tbody>{items.map((task) => <TaskRow key={task.taskId} onOpen={onOpen} selected={selectedIds.has(task.taskId)} task={task} onSelect={onSelect} />)}</tbody>
      </table>
      {!loading && !items.length ? <p className="px-3 py-4 text-sm text-slate-500">No script tasks found.</p> : null}
    </div>
  );
}

function TaskRow({ onOpen, task, selected, onSelect }) {
  const active = !TERMINAL_STATES.has(task.state);
  return <tr className={`border-t border-slate-100 text-slate-700 ${onOpen ? "cursor-pointer hover:bg-slate-50" : ""}`} onClick={() => onOpen?.(task)}><td className="px-3 py-2"><input aria-label={`Select task ${task.name}`} checked={selected} disabled={!active} onChange={(event) => onSelect(task.taskId, event.target.checked)} onClick={(event) => event.stopPropagation()} type="checkbox" /></td><td className="truncate px-3 py-2 font-mono" title={task.taskId}>{task.taskId.slice(0, 5)}</td><td className="truncate px-3 py-2" title={task.name}>{task.name}</td><td className="px-3 py-2">{task.state}</td><td className="px-3 py-2">{task.progress == null ? "—" : `${Math.round(task.progress * 100)}%`}</td><td className="px-3 py-2">{formatTime(task.createdAt)}</td><td className="px-3 py-2">{formatTime(task.endedAt)}</td></tr>;
}

function CancelTasksModal({ tasks, error, onCancel, onClose }) {
  return <Modal title={tasks.length === 1 ? "Cancel Script Task" : "Cancel Script Tasks"} onClose={onClose}><div className="grid gap-4"><p>Cancel {tasks.length === 1 ? <>task <strong>{tasks[0].name}</strong></> : `${tasks.length} tasks`}?</p>{error ? <p className="text-xs text-rose-600">{error}</p> : null}<button className="control-standard bg-rose-600 px-3 font-medium text-white" onClick={onCancel} type="button">Cancel</button></div></Modal>;
}

function ScriptTaskActionListener({ onCancel, onRefresh }) {
  useEffect(() => {
    window.addEventListener(CANCEL_EVENT, onCancel);
    window.addEventListener(REFRESH_EVENT, onRefresh);
    return () => {
      window.removeEventListener(CANCEL_EVENT, onCancel);
      window.removeEventListener(REFRESH_EVENT, onRefresh);
    };
  }, [onCancel, onRefresh]);
  return null;
}
function emptyPage() { return { items: [], limit: PAGE_SIZE, offset: 0, total: 0 }; }
function normalisePage(payload) { return { items: Array.isArray(payload?.items) ? payload.items : [], limit: Number(payload?.limit) || PAGE_SIZE, offset: Number(payload?.offset) || 0, total: Number(payload?.total) || 0 }; }
function updateSelection(current, id, selected) { const next = new Set(current); if (selected) next.add(id); else next.delete(id); return next; }
function formatTime(value) { return value ? new Date(value).toLocaleString() : "—"; }
async function readResponse(response) { const text = await response.text(); try { return text ? JSON.parse(text) : null; } catch { return { message: text }; } }
async function cancelTask(apiUrl, task) { const response = await fetch(`${apiUrl}/${task.taskId}/cancel`, { method: "POST" }); if (!response.ok) throw new Error((await readResponse(response))?.message || `Could not cancel ${task.name}.`); }
