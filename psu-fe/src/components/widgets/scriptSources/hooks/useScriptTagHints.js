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
import { useCallback, useEffect, useState } from "react";

const hintCache = new Map();

/** Test-only cache reset to keep isolated component tests deterministic. */
export function clearScriptTagHintCacheForTests() {
  hintCache.clear();
}

/**
 * Lazily loads the bounded user-script tag hint list.
 *
 * The module cache lasts for the active browser session and is keyed by the configured backend URL.
 */
export function useScriptTagHints(apiUrl, enabled = false) {
  const [tags, setTags] = useState(() => hintCache.get(apiUrl) || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (force = false) => {
    const cached = hintCache.get(apiUrl);
    if (!force && cached) {
      setTags(cached);
      return cached;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/user/tags`, { headers: { Accept: "application/json" } });
      const text = await response.text();
      const body = text ? JSON.parse(text) : null;
      if (!response.ok || !Array.isArray(body)) throw new Error(body?.message || `HTTP ${response.status}`);
      hintCache.set(apiUrl, body);
      setTags(body);
      return body;
    } catch (requestError) {
      setError(requestError?.message || "Could not load tag suggestions.");
      return [];
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  const reload = useCallback(() => load(true), [load]);
  return { error, load, loading, reload, tags };
}
