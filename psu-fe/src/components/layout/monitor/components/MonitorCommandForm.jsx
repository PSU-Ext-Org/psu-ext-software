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
import { Send } from "lucide-react";

/**
 * Sends a SCPI command to a connected monitor target.
 *
 * @param {object} props
 * @param {object} props.command - Command form values, targets, and callbacks.
 * @param {boolean} props.dockCommand - Whether the form is pinned to its container bottom.
 * @returns {import("react").ReactElement}
 */
export function MonitorCommandForm({ command, dockCommand }) {
  const formClassName = `${dockCommand ? "mt-auto" : ""} flex gap-2`;
  const hasTargets = command.targets.length > 0;
  const sendDisabled = !command.canSend || !command.value.trim();
  const placeholder = command.canSend
    ? "Enter device command"
    : "Connect WebSocket and target first";

  function handleTargetChange(event) {
    command.selectTarget(event.target.value);
  }

  function handleCommandChange(event) {
    command.changeValue(event.target.value);
  }

  function handleSubmit(event) {
    event.preventDefault();
    command.submit();
  }

  return (
    <form className={formClassName} onSubmit={handleSubmit}>
      <select
        aria-label="Command target device"
        className="control-standard w-36 min-w-0 border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
        disabled={!command.isConnected || !hasTargets}
        onChange={handleTargetChange}
        value={command.targetName}
      >
        {hasTargets ? (
          command.targets.map((device) => (
            <option key={device.id} value={device.name}>
              {device.name}
            </option>
          ))
        ) : (
          <option value="">No devices</option>
        )}
      </select>
      <input
        className="control-standard min-w-0 flex-1 border border-slate-300 bg-white text-slate-950 outline-none focus:border-teal-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
        disabled={!command.canSend}
        onChange={handleCommandChange}
        placeholder={placeholder}
        value={command.value}
      />
      <button
        className="control-standard inline-flex items-center justify-center gap-2 bg-teal-700 font-medium text-white hover:bg-teal-800 disabled:opacity-50"
        disabled={sendDisabled}
        type="submit"
      >
        <Send className="h-4 w-4" />
        Send
      </button>
    </form>
  );
}
