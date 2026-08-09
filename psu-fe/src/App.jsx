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
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ScriptRunnerHttpProvider } from "./connection/http-script/ScriptRunnerHttpContext.jsx";
import { WebSocketConnectionProvider } from "./connection/ws-proxy/WebSocketConnectionContext.jsx";
import { AppFooter } from "./components/layout/app/AppFooter.jsx";
import { AppHeader } from "./components/layout/app/AppHeader.jsx";
import { PageDashboard } from "./components/pages/dashboard/operator/PageDashboard.jsx";
import { PageOther } from "./components/pages/dashboard/other/PageOther.jsx";
import { PageConfigProxy } from "./components/pages/dashboard/proxy/PageConfigProxy.jsx";
import { PageIde } from "./components/pages/ide/PageIde.jsx";

export default function App() {
  return (
    <WebSocketConnectionProvider>
      <ScriptRunnerHttpProvider>
        <AppFrame />
      </ScriptRunnerHttpProvider>
    </WebSocketConnectionProvider>
  );
}

function AppFrame() {
  const location = useLocation();
  const ide = location.pathname === "/ide";
  return (
    <>
      {!ide ? <AppHeader /> : null}
        <Routes>
        <Route path="/" element={<PageDashboard />} />
        <Route path="/extra" element={<PageOther />} />
        <Route path="/dashboard" element={<PageDashboard />} />
        <Route path="/conf-proxy" element={<PageConfigProxy />} />
        <Route path="/ide" element={<PageIde />} />
        <Route path="/scripting" element={<Navigate to="/ide" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      {!ide ? <AppFooter /> : null}
    </>
  );
}
