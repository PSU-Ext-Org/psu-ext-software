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
import { useEffect } from "react";
import { DashboardPageShell } from "../../../dashboard/components/DashboardPageShell.jsx";
import {
  clearLegacyProxyLayouts,
  proxyDashboard,
} from "./proxyDashboard.js";

/**
 * Proxy configuration page rendered as fixed dashboard widgets.
 *
 * @returns {import("react").ReactElement}
 */
export function PageConfigProxy() {
  useEffect(() => {
    clearLegacyProxyLayouts();
  }, []);

  return <DashboardPageShell dashboard={proxyDashboard} />;
}
