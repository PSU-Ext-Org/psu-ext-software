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
import { WebSocketMonitor } from "../../layout/monitor/WebSocketMonitor.jsx";

/**
 * Reusable raw WebSocket monitor dashboard widget.
 *
 * @returns {import("react").ReactElement}
 */
export function WebSocketMonitorWidget() {
  return <WebSocketMonitor dockCommand logClassName="h-[18.7rem]" wrapLog />;
}