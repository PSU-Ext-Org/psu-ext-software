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
import { OperatorCard } from "../../cards/OperatorCard.jsx";
import { MonitorCommandForm } from "./components/MonitorCommandForm.jsx";
import { MonitorLog } from "./components/MonitorLog.jsx";
import { MonitorTagFilters } from "./components/MonitorTagFilters.jsx";
import { useWebSocketMonitor } from "./hooks/useWebSocketMonitor.js";

/**
 * Full WebSocket monitor card reused by inline and popup views.
 *
 * @param {object} props
 * @param {string} [props.logClassName] - Height/size classes for the log viewport.
 * @param {boolean} [props.wrapLog] - Wraps long log lines to avoid horizontal scrolling.
 * @returns {import("react").ReactElement}
 */
export function WebSocketMonitorCard({ logClassName = "h-80", wrapLog = true }) {
  return (
    <OperatorCard
      title="WebSocket Monitor"
      text="Raw websocket activity, newest messages at the bottom."
    >
      <WebSocketMonitor logClassName={logClassName} wrapLog={wrapLog} />
    </OperatorCard>
  );
}

/**
 * Shared WebSocket monitor body.
 *
 * @param {object} props
 * @param {string} [props.logClassName] - Height/size classes for the log viewport.
 * @param {boolean} [props.dockCommand] - Pins the terminal input to the bottom of the monitor body.
 * @param {boolean} [props.wrapLog] - Wraps long log lines to avoid horizontal scrolling.
 * @returns {import("react").ReactElement}
 */
export function WebSocketMonitor({
  logClassName = "h-80",
  dockCommand = false,
  wrapLog = false,
}) {
  const monitor = useWebSocketMonitor();
  const containerClassName = dockCommand ? "flex min-h-full flex-col gap-3" : "grid gap-3";

  return (
    <div className={containerClassName}>
      <MonitorLog log={monitor.log} logClassName={logClassName} wrapLog={wrapLog} />
      <MonitorTagFilters filters={monitor.filters} />
      <MonitorCommandForm command={monitor.command} dockCommand={dockCommand} />
    </div>
  );
}
