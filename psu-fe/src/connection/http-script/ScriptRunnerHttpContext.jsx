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
import { createContext, useContext, useMemo, useState } from "react";
import {
  getScriptRunnerDeviceApiUrl,
  getScriptRunnerScriptSourceApiUrl,
  getScriptRunnerTaskApiUrl,
  loadScriptRunnerHttpConfig,
  saveScriptRunnerHttpConfig,
} from "./scriptRunnerHttpConfig.js";

const ScriptRunnerHttpContext = createContext(null);

/**
 * Owns the independent Script Runner HTTP endpoint and auto-connect settings.
 *
 * @param {{children: import("react").ReactNode}} props
 * @returns {import("react").ReactElement}
 */
export function ScriptRunnerHttpProvider({ children }) {
  const [config, setConfig] = useState(loadScriptRunnerHttpConfig);
  const value = useMemo(() => ({
    config,
    deviceApiUrl: getScriptRunnerDeviceApiUrl(config),
    scriptSourceApiUrl: getScriptRunnerScriptSourceApiUrl(config),
    scriptTaskApiUrl: getScriptRunnerTaskApiUrl(config),
    scriptBindingApiUrl: `${getScriptRunnerTaskApiUrl(config)}/bindings`,
    saveEndpoint(fields) {
      setConfig((current) => {
        const next = { ...current, ...fields };
        saveScriptRunnerHttpConfig(next);
        return next;
      });
    },
    setDeviceAutoConnect(id, enabled) {
      setConfig((current) => {
        const normalizedId = String(id);
        const autoConnectIds = enabled
          ? [...new Set([...current.autoConnectIds, normalizedId])]
          : current.autoConnectIds.filter((currentId) => currentId !== normalizedId);
        const next = { ...current, autoConnectIds };
        saveScriptRunnerHttpConfig(next);
        return next;
      });
    },
  }), [config]);

  return (
    <ScriptRunnerHttpContext.Provider value={value}>
      {children}
    </ScriptRunnerHttpContext.Provider>
  );
}

/** @returns {{config: object, apiUrl: string, scriptSourceApiUrl: string, scriptTaskApiUrl: string, saveEndpoint: Function, setAutoConnect: Function}} */
export function useScriptRunnerHttp() {
  const context = useContext(ScriptRunnerHttpContext);
  if (!context) {
    throw new Error("useScriptRunnerHttp must be used inside ScriptRunnerHttpProvider");
  }
  return context;
}
