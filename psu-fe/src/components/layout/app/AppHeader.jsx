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
import { FileCode2, Terminal } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useWebSocketConnection } from "../../../connection/ws-proxy/WebSocketConnectionContext.jsx";
import { countConnectedDevices } from "../../../connection/ws-proxy/device/deviceRegistry.js";
import { WebSocketMonitorDialog } from "../monitor/WebSocketMonitorDialog.jsx";

/**
 * Thin sticky application header with project branding and primary navigation.
 *
 * @returns {import("react").ReactElement}
 */
export function AppHeader() {
  const [monitorOpen, setMonitorOpen] = useState(false);
  const { wsConnected, deviceStatuses } = useWebSocketConnection();

  function openMonitor() {
    setMonitorOpen(true);
  }

  function closeMonitor() {
    setMonitorOpen(false);
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <NavLink
              aria-label="PSU-EXT home"
              className="group flex min-w-0 items-center gap-2.5"
              to="/"
            >
              <span
                className={[
                  "relative flex h-7 w-7 items-center justify-center rounded-md border",
                  "border-slate-300 bg-slate-950 shadow-sm",
                ].join(" ")}
              >
                <span
                  aria-hidden="true"
                  className={[
                    "h-5 w-3.5 bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.55)]",
                    "[clip-path:polygon(58%_0,18%_47%,48%_47%,32%_100%,86%_36%,55%_36%)]",
                  ].join(" ")}
                />
              </span>
              <span className="truncate text-sm font-semibold tracking-normal text-slate-950 group-hover:text-teal-800">
                PSU-EXT
              </span>
            </NavLink>
            <HeaderConnectionStatus
              connectedDeviceCount={countConnectedDevices(deviceStatuses)}
              wsConnected={wsConnected}
            />
          </div>

          <nav aria-label="Primary navigation" className="flex items-center gap-1">
            <HeaderLink to="/ide">
              <FileCode2 aria-hidden="true" className="h-4 w-4" />
              IDE
            </HeaderLink>
            <HeaderLink to="/" end>Dashboard</HeaderLink>
            <HeaderLink to="/extra">Extra</HeaderLink>
            <HeaderLink to="/conf-proxy">Config</HeaderLink>
            <button
              aria-label="Open WebSocket monitor"
              className={[
                "inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600",
                "hover:bg-slate-100 hover:text-slate-950",
              ].join(" ")}
              onClick={openMonitor}
              type="button"
            >
              <Terminal className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </header>
      <WebSocketMonitorDialog open={monitorOpen} onClose={closeMonitor} />
    </>
  );
}

/**
 * Compact app-wide connection state indicator.
 *
 * @param {object} props
 * @param {boolean} props.wsConnected - Whether the browser is connected to the proxy WebSocket.
 * @param {number} props.connectedDeviceCount - Number of connected backend devices.
 * @returns {import("react").ReactElement}
 */
function HeaderConnectionStatus({ wsConnected, connectedDeviceCount }) {
  const state = !wsConnected ? "offline" : connectedDeviceCount > 0 ? "connected" : "proxy";
  const label = !wsConnected
    ? "Offline"
    : connectedDeviceCount > 0
      ? `${connectedDeviceCount} ${connectedDeviceCount === 1 ? "device" : "devices"} connected`
      : "Proxy only";

  return (
    <div
      aria-label={`Connection status: ${label}`}
      className="hidden min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-xs text-slate-600 sm:inline-flex"
    >
      <StatusDot state={state} />
      <span className="max-w-44 truncate font-medium text-slate-700">{label}</span>
    </div>
  );
}

function StatusDot({ state }) {
  const className = {
    offline: "bg-red-500",
    proxy: "bg-amber-400",
    connected: "bg-emerald-500",
  }[state];

  return (
    <span
      aria-hidden="true"
      className={["h-3 w-3 rounded-full ring-2 ring-current/20", className].join(" ")}
    />
  );
}

/**
 * Header navigation link with active route styling.
 *
 * @param {object} props
 * @param {string} props.to - Route target.
 * @param {boolean} [props.end] - Whether the route must match exactly.
 * @param {import("react").ReactNode} props.children - Link label.
 * @returns {import("react").ReactElement}
 */
function HeaderLink({ to, end = false, children }) {
  return (
    <NavLink
      className={({ isActive }) =>
        [
          "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition",
          isActive
            ? "bg-slate-100 text-slate-950"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
        ].join(" ")
      }
      end={end}
      to={to}
    >
      {children}
    </NavLink>
  );
}
