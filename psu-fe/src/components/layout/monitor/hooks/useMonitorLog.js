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
import { formatMonitorDownloadTimestamp } from "../../../../connection/ws-proxy/monitor/monitorTime.js";

/**
 * Owns log scrolling, download, and the deliberate two-click clear action.
 *
 * @param {string} wsMessages - Complete WebSocket log text used for size and download.
 * @param {string} text - Filtered text displayed in the viewport.
 * @param {() => void} clearWsMessages - Clears the connection's stored WebSocket log.
 * @returns {object} Log view model consumed by MonitorLog.
 */
export function useMonitorLog(wsMessages, text, clearWsMessages) {
  const viewportRef = useRef(null);
  const clearButtonRef = useRef(null);
  const [clearArmed, setClearArmed] = useState(false);

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [text]);

  useEffect(() => {
    if (!wsMessages) {
      setClearArmed(false);
    }
  }, [wsMessages]);

  useEffect(() => {
    if (!clearArmed) {
      return undefined;
    }

    function disarmOnOutsidePointerDown(event) {
      if (!clearButtonRef.current?.contains(event.target)) {
        setClearArmed(false);
      }
    }

    window.addEventListener("pointerdown", disarmOnOutsidePointerDown, true);
    return () => window.removeEventListener("pointerdown", disarmOnOutsidePointerDown, true);
  }, [clearArmed]);

  function confirmOrClear() {
    if (!clearArmed) {
      setClearArmed(true);
      return;
    }

    setClearArmed(false);
    clearWsMessages();
  }

  function download() {
    if (!wsMessages) {
      return;
    }

    const blob = new Blob([wsMessages], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `psu-fe-websocket-log-${formatMonitorDownloadTimestamp(new Date())}.txt`;
    document.body.append(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  return {
    byteLength: wsMessages.length,
    clear: {
      armed: clearArmed,
      buttonRef: clearButtonRef,
      confirm: confirmOrClear,
    },
    download,
    text,
    viewportRef,
  };
}
