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
import { LogOverlayActions } from "../LogOverlayActions.jsx";

/**
 * Renders the monitor viewport and its log-specific actions.
 *
 * @param {object} props
 * @param {object} props.log - Displayed monitor log state and actions.
 * @param {string} props.logClassName - Height/size classes for the viewport.
 * @param {boolean} props.wrapLog - Whether long lines should wrap.
 * @returns {import("react").ReactElement}
 */
export function MonitorLog({ log, logClassName, wrapLog }) {
  const viewportClassName = [
    logClassName,
    "rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-100",
    wrapLog
      ? "overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words"
      : "overflow-auto",
  ].join(" ");

  return (
    <div className="relative">
      <pre className={viewportClassName} ref={log.viewportRef}>
        {log.text}
      </pre>
      <LogOverlayActions
        byteLength={log.byteLength}
        clearArmed={log.clear.armed}
        clearButtonRef={log.clear.buttonRef}
        onClear={log.clear.confirm}
        onDownload={log.download}
        showClear
      />
    </div>
  );
}
