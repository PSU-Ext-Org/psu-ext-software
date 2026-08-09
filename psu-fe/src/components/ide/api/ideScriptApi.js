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
/** Performs a JSON request against the Script Runner API. */
export async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(body?.message || `HTTP ${response.status}`);
  return body;
}

/** Saves a script and starts its resulting task. */
export async function saveAndRun(sourceApiUrl, taskApiUrl, script, savedId) {
  const sourceUrl = savedId
    ? `${sourceApiUrl}/user/${encodeURIComponent(savedId)}`
    : `${sourceApiUrl}/user`;
  const saved = await requestJson(sourceUrl, {
    method: savedId ? "PUT" : "POST",
    body: JSON.stringify(script),
  });
  const task = await requestJson(taskApiUrl, {
    method: "POST",
    body: JSON.stringify({ name: saved.name, source: saved.sourceCode }),
  });
  return { script: saved, state: task.state, taskId: task.taskId };
}
