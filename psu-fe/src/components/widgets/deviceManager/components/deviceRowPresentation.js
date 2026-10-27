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
/** Formats the configured TCP or USB endpoint for a device row. */
export function formatEndpoint(device) {
  return device.type === "USB"
    ? `${device.port || "COM?"} @ ${device.baudrate || "baud?"}`
    : `${device.ip || "host?"}:${device.port || "port?"}`;
}

/** Displays parsed identity, raw identity, or the last device error. */
export function formatIdentity(status) {
  if (status?.identity?.valid) {
    return `${status.identity.name} | SN ${status.identity.serialNumber} | FW ${status.identity.firmwareLevel}`;
  }
  return status?.identity?.raw || status?.error || "-";
}

/** Selects badge styling, including recovery waits and attempts. */
export function statusBadgeClass(status) {
  if (status?.reconnecting) {
    return "inline-flex rounded px-2 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800";
  }
  return `inline-flex rounded px-2 py-0.5 text-xs font-semibold ${status?.state === "CONNECTED"
    ? "bg-emerald-50 text-emerald-800"
    : "bg-slate-100 text-slate-600"}`;
}

/** Returns the operator-facing connection state. */
export function formatStatus(status) {
  return status?.reconnecting ? "Reconnecting" : status?.state || "DISCONNECTED";
}

/** Derives the primary action from connection state without embedding policy in JSX. */
export function getConnectionAction(status, connecting) {
  if (status?.reconnecting) {
    return {
      label: "Cancel",
      disconnect: true,
      disabled: false,
      className: "control-standard w-24 bg-red-700 px-3 font-medium text-white hover:bg-red-800",
    };
  }
  if (status?.state === "CONNECTED") {
    return {
      label: "Disconnect",
      disconnect: true,
      disabled: false,
      className: "control-standard w-24 border border-slate-200 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50",
    };
  }
  return {
    label: connecting ? "Connecting..." : "Connect",
    disconnect: false,
    disabled: Boolean(connecting),
    className: "control-standard w-24 bg-teal-700 px-3 font-medium text-white hover:bg-teal-800 disabled:opacity-50",
  };
}
