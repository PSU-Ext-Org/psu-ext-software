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
import { DeviceRowActions } from "./DeviceRowActions.jsx";
import { IdentityCell } from "./IdentityCell.jsx";
import { formatEndpoint, formatStatus, statusBadgeClass } from "./deviceRowPresentation.js";

/**
 * Renders normalized device rows and their management actions.
 * Automatic recovery shows a yellow status during attempts and between retries.
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
                <span className={statusBadgeClass(status)}>
                  {formatStatus(status)}
                </span>
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
