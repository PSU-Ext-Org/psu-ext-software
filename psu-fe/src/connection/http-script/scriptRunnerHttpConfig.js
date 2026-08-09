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
export const SCRIPT_RUNNER_HTTP_CONFIG_KEY = "psu-fe.script-backend.config";

export const EMPTY_SCRIPT_RUNNER_HTTP_CONFIG = {
  autoConnectIds: [],
  scheme: "http",
  host: "localhost",
  port: "8081",
  rootPath: "",
};

/**
 * Loads the persisted Script Runner endpoint configuration.
 *
 * @returns {typeof EMPTY_SCRIPT_RUNNER_HTTP_CONFIG}
 */
export function loadScriptRunnerHttpConfig() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SCRIPT_RUNNER_HTTP_CONFIG_KEY));
    if (!saved || typeof saved !== "object") return EMPTY_SCRIPT_RUNNER_HTTP_CONFIG;
    return {
      ...EMPTY_SCRIPT_RUNNER_HTTP_CONFIG,
      ...saved,
      autoConnectIds: Array.isArray(saved.autoConnectIds) ? saved.autoConnectIds.map(String) : [],
    };
  } catch {
    return EMPTY_SCRIPT_RUNNER_HTTP_CONFIG;
  }
}

/** @param {typeof EMPTY_SCRIPT_RUNNER_HTTP_CONFIG} config */
export function saveScriptRunnerHttpConfig(config) {
  window.localStorage.setItem(SCRIPT_RUNNER_HTTP_CONFIG_KEY, JSON.stringify(config));
}

/**
 * Builds the Script Runner device-manager endpoint URL.
 *
 * @param {typeof EMPTY_SCRIPT_RUNNER_HTTP_CONFIG} config
 * @returns {string}
 */
export function getScriptRunnerDeviceApiUrl(config) {
  return `${getScriptRunnerBaseUrl(config)}/api/devices`;
}

/**
 * Builds the Script Runner script-source API URL.
 *
 * @param {typeof EMPTY_SCRIPT_RUNNER_HTTP_CONFIG} config
 * @returns {string}
 */
export function getScriptRunnerScriptSourceApiUrl(config) {
  return `${getScriptRunnerBaseUrl(config)}/api/scripts/source`;
}

/**
 * Builds the Script Runner all-task API URL.
 *
 * @param {typeof EMPTY_SCRIPT_RUNNER_HTTP_CONFIG} config
 * @returns {string}
 */
export function getScriptRunnerTaskApiUrl(config) {
  return `${getScriptRunnerBaseUrl(config)}/api/scripts`;
}

/**
 * Builds the Script Runner Actuator health URL.
 *
 * @param {typeof EMPTY_SCRIPT_RUNNER_HTTP_CONFIG} config
 * @returns {string}
 */
export function getScriptRunnerHealthUrl(config) {
  return `${getScriptRunnerBaseUrl(config)}/actuator/health`;
}

function getScriptRunnerBaseUrl(config) {
  const rootPath = normaliseRootPath(config.rootPath);
  return `${config.scheme}://${config.host}:${config.port}${rootPath}`;
}

function normaliseRootPath(path) {
  if (!path) return "";
  return `/${path.replace(/^\/+|\/+$/g, "")}`;
}
