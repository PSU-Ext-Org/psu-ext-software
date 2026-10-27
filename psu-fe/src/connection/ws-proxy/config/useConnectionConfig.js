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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clearConfigStorage, EMPTY_CONFIG, loadConfig, saveConfigToStorage } from "./connectionConfig.js";

const ENDPOINT_FIELDS = new Set(["wsScheme", "wsHost", "wsPort", "wsPath"]);
const AUTOMATION_FIELDS = new Set(["autoConnect", "deviceAutoConnectIds", "wsDeviceAutoConnectIds"]);

/** Separates endpoint, automation, and legacy settings without changing stored fields. */
function groupConfig(config) {
  const groups = { endpoint: {}, automation: {}, legacy: {} };
  for (const [key, value] of Object.entries(config)) {
    groups[configGroup(key)][key] = value;
  }
  return groups;
}

function configGroup(key) {
  if (ENDPOINT_FIELDS.has(key)) return "endpoint";
  return AUTOMATION_FIELDS.has(key) ? "automation" : "legacy";
}

/**
 * Owns manually saved endpoint settings and immediately saved auto-connect settings.
 * The public config remains flat for compatibility; internal state is grouped by purpose.
 * @param {(direction: string, message: string) => void} appendWsMessage
 */
export function useConnectionConfig(appendWsMessage) {
  const [groups, setGroups] = useState(() => groupConfig(loadConfig()));
  const config = useMemo(() => ({ ...groups.endpoint, ...groups.automation, ...groups.legacy }), [groups]);
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const updateConfig = useCallback((key, value) => {
    setGroups((current) => {
      const group = configGroup(key);
      const next = { ...current, [group]: { ...current[group], [key]: value } };
      if (key === "autoConnect" || key === "wsDeviceAutoConnectIds") {
        saveConfigToStorage({ ...next.endpoint, ...next.automation, ...next.legacy });
        appendWsMessage("config", key === "autoConnect"
          ? `Saved connection config to localStorage (${value ? "proxy auto-connect enabled" : "proxy auto-connect disabled"})`
          : "Saved connection config to localStorage (device auto-connect updated)");
      }
      return next;
    });
  }, [appendWsMessage]);

  const setWsDeviceAutoConnect = useCallback((id, enabled) => {
    const normalizedId = String(id);
    setGroups((current) => {
      const ids = current.automation.wsDeviceAutoConnectIds || [];
      const nextIds = enabled
        ? Array.from(new Set([...ids, normalizedId]))
        : ids.filter((deviceId) => deviceId !== normalizedId);
      const automation = { ...current.automation, wsDeviceAutoConnectIds: nextIds, deviceAutoConnectIds: nextIds };
      const next = { ...current, automation };
      saveConfigToStorage({ ...next.endpoint, ...automation, ...next.legacy });
      appendWsMessage("config", `Saved connection config to localStorage (device ${normalizedId} auto-connect ${enabled ? "enabled" : "disabled"})`);
      return next;
    });
  }, [appendWsMessage]);

  const saveConfig = useCallback(() => {
    saveConfigToStorage(configRef.current);
    appendWsMessage("config", "Saved connection config to localStorage");
  }, [appendWsMessage]);

  const clearConfig = useCallback(() => {
    setGroups(groupConfig(EMPTY_CONFIG));
    configRef.current = EMPTY_CONFIG;
    clearConfigStorage();
    appendWsMessage("config", "Cleared connection config");
  }, [appendWsMessage]);

  return { config, configRef, updateConfig, setWsDeviceAutoConnect, saveConfig, clearConfig };
}
