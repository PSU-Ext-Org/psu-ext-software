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
import { Settings, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

/**
 * Renders normalized device rows and their management actions.
 *
 * @param {{manager: object, onDelete: Function, onEdit: Function, rows: object[]}} props
 * @returns {import("react").ReactElement}
 */
export function DeviceTable({ rows, manager, onEdit, onDelete }) {
  return (
    <div className="max-h-96 overflow-auto rounded-md border border-slate-200">
      <table className="min-w-full table-fixed divide-y divide-slate-200 text-left text-sm">
        <colgroup>
          <col className="w-12" />
          <col className="w-24" />
          <col className="w-20" />
          <col className="w-44" />
          <col className="w-64" />
          <col className="w-32" />
          <col className="w-16" />
          <col className="w-40" />
        </colgroup>
        <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Endpoint</th>
            <th className="px-3 py-2">Identity</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-center" title="Auto-connect">AUTO</th>
            <th className="px-3 py-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {!rows.length ? (
            <tr>
              <td className="px-3 py-4 text-center text-sm text-slate-400" colSpan={8}>
                No devices configured. Use Add Device to create one.
              </td>
            </tr>
          ) : rows.map(({ device, status, autoConnect, connecting }) => (
            <tr key={device.id}>
              <td className="whitespace-nowrap px-3 py-2 font-medium">{device.id}</td>
              <td className="whitespace-nowrap px-3 py-2 font-semibold">{device.name}</td>
              <td className="whitespace-nowrap px-3 py-2">{device.type}</td>
              <td className="whitespace-nowrap px-3 py-2">{formatEndpoint(device)}</td>
              <td className="max-w-64 px-3 py-2">
                <IdentityCell status={status} />
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <span className={statusBadgeClass(status)}>{status?.state || "DISCONNECTED"}</span>
              </td>
              <td className="px-3 py-2 text-center">
                <input
                  aria-label={`Auto-connect device ${device.name}`}
                  checked={autoConnect}
                  onChange={(event) => manager.setAutoConnect(device.id, event.target.checked)}
                  title="Auto-connect"
                  type="checkbox"
                />
              </td>
              <td className="px-3 py-2 text-right">
                <div className="flex items-center justify-end gap-2">
                  <DeviceRowActions
                    connecting={connecting}
                    device={device}
                    manager={manager}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    status={status}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeviceRowActions({ connecting, device, manager, status, onDelete, onEdit }) {
  const connected = status?.state === "CONNECTED";

  return (
    <>
      <button
        className={connected
          ? "control-standard w-24 border border-slate-200 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50"
          : "control-standard w-24 bg-teal-700 px-3 font-medium text-white hover:bg-teal-800 disabled:opacity-50"}
        disabled={!connected && connecting}
        onClick={() => Promise.resolve(
          connected ? manager.disconnectDevice(device.id) : manager.connectDevice(device.id),
        ).catch(() => {})}
        type="button"
      >
        {connected ? "Disconnect" : connecting ? "Connecting..." : "Connect"}
      </button>
      <button
        aria-label={`Edit device ${device.name}`}
        className="control-standard border border-slate-200 bg-white p-1.5"
        onClick={() => onEdit(device)}
        type="button"
      >
        <Settings className="h-3.5 w-3.5" />
      </button>
      <button
        aria-label={`Delete device ${device.name}`}
        className="control-standard border border-rose-200 bg-white p-1.5 text-rose-700"
        onClick={() => onDelete(device)}
        type="button"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </>
  );
}

function formatEndpoint(device) {
  return device.type === "USB"
    ? `${device.port || "COM?"} @ ${device.baudrate || "baud?"}`
    : `${device.ip || "host?"}:${device.port || "port?"}`;
}

function formatIdentity(status) {
  if (status?.identity?.valid) {
    return `${status.identity.name} | SN ${status.identity.serialNumber} | FW ${status.identity.firmwareLevel}`;
  }
  return status?.identity?.raw || status?.error || "-";
}

/**
 * Shows the identity text, panning it into view on hover when it overflows the cell.
 *
 * @param {{status: object}} props
 * @returns {import("react").ReactElement}
 */
function IdentityCell({ status }) {
  const text = formatIdentity(status);
  const containerRef = useRef(null);
  const [shift, setShift] = useState(0);

  const handleEnter = () => {
    const el = containerRef.current;
    if (el) {
      setShift(Math.max(0, el.scrollWidth - el.clientWidth));
    }
  };

  return (
    <div className="overflow-hidden" onMouseEnter={handleEnter} onMouseLeave={() => setShift(0)} ref={containerRef} title={text}>
      <span
        className="inline-block whitespace-nowrap ease-linear"
        style={{ transform: `translateX(-${shift}px)`, transitionDuration: `${Math.max(400, shift * 15)}ms`, transitionProperty: "transform" }}
      >
        {text}
      </span>
    </div>
  );
}

function statusBadgeClass(status) {
  return `inline-flex rounded px-2 py-0.5 text-xs font-semibold ${status?.state === "CONNECTED"
    ? "bg-emerald-50 text-emerald-800"
    : "bg-slate-100 text-slate-600"}`;
}
