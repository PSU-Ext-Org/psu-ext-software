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

let runtimeConfig = null;

/**
 * Loads optional installer-generated endpoint defaults before React providers mount.
 * Development and standalone builds keep their existing defaults when the file is absent.
 *
 * @returns {Promise<void>}
 */
export async function loadRuntimeConfig() {
  try {
    const response = await fetch("/runtime-config.json", { cache: "no-store" });
    if (!response.ok) return;
    runtimeConfig = await response.json();
  } catch {
    runtimeConfig = null;
  }
}

/** @returns {Partial<import("../ws-proxy/config/connectionConfig.js").EMPTY_CONFIG>} */
export function getRuntimeWebSocketDefaults() {
  const proxy = runtimeConfig?.proxy;
  if (!isEndpoint(proxy)) return {};

  return {
    wsScheme: proxy.scheme || "ws",
    wsHost: proxy.host,
    wsPort: String(proxy.port),
    wsPath: proxy.path || "/ws/scpi",
  };
}

/** @returns {Partial<import("../http-script/scriptRunnerHttpConfig.js").EMPTY_SCRIPT_RUNNER_HTTP_CONFIG>} */
export function getRuntimeScriptRunnerDefaults() {
  const scriptRunner = runtimeConfig?.scriptRunner;
  if (!isEndpoint(scriptRunner)) return {};

  return {
    scheme: scriptRunner.scheme || "http",
    host: scriptRunner.host,
    port: String(scriptRunner.port),
    rootPath: scriptRunner.rootPath || "/runner",
  };
}

/** @param {unknown} endpoint @returns {boolean} */
function isEndpoint(endpoint) {
  return Boolean(endpoint && typeof endpoint === "object" && endpoint.host && endpoint.port);
}
