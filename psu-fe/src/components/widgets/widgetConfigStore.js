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
import { useEffect, useState } from "react";

export const WIDGET_CONFIG_STORAGE_KEY = "psu-ext.widget-configs.v1";
export const WIDGET_CONFIG_CHANGE_EVENT = "psu-ext-widget-configs-change";

/**
 * @returns {Record<string, unknown>}
 */
export function loadStoredWidgetConfigs() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WIDGET_CONFIG_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * @param {string} widgetId
 * @returns {unknown}
 */
export function loadStoredWidgetConfig(widgetId) {
  return loadStoredWidgetConfigs()[widgetId];
}

/**
 * @param {string} widgetId
 * @param {unknown} config
 * @returns {unknown}
 */
export function saveStoredWidgetConfig(widgetId, config) {
  const configs = loadStoredWidgetConfigs();
  window.localStorage.setItem(
    WIDGET_CONFIG_STORAGE_KEY,
    JSON.stringify({
      ...configs,
      [widgetId]: config,
    }),
  );
  dispatchWidgetConfigChange(widgetId);
  return config;
}

/**
 * @param {string} widgetId
 */
export function deleteStoredWidgetConfig(widgetId) {
  const configs = loadStoredWidgetConfigs();
  if (!Object.hasOwn(configs, widgetId)) {
    return;
  }

  const { [widgetId]: _removed, ...remainingConfigs } = configs;
  window.localStorage.setItem(WIDGET_CONFIG_STORAGE_KEY, JSON.stringify(remainingConfigs));
  dispatchWidgetConfigChange(widgetId);
}

/**
 * @param {string} widgetId
 * @param {(widgetId: string) => unknown} loadConfig
 * @returns {[unknown, (config: unknown) => void]}
 */
export function useStoredWidgetConfig(widgetId, loadConfig) {
  const [config, setConfig] = useState(() => loadConfig(widgetId));

  useEffect(() => {
    function syncConfig(event) {
      if (!event.detail?.widgetId || event.detail.widgetId === widgetId) {
        setConfig(loadConfig(widgetId));
      }
    }

    window.addEventListener(WIDGET_CONFIG_CHANGE_EVENT, syncConfig);
    window.addEventListener("storage", syncConfig);
    return () => {
      window.removeEventListener(WIDGET_CONFIG_CHANGE_EVENT, syncConfig);
      window.removeEventListener("storage", syncConfig);
    };
  }, [loadConfig, widgetId]);

  return [config, setConfig];
}

/**
 * @param {string} widgetId
 */
export function dispatchWidgetConfigChange(widgetId) {
  window.dispatchEvent(new CustomEvent(WIDGET_CONFIG_CHANGE_EVENT, { detail: { widgetId } }));
}
