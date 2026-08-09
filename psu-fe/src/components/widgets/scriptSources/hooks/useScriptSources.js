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
import { useCallback, useEffect, useMemo, useState } from "react";

const BUILTIN_LIMIT = 500;
const USER_LIMIT = 10;

/**
 * Loads and mutates the Script Runner user script catalogue.
 *
 * Builtin scripts are loaded only when a create or edit dialog requests a template.
 *
 * @param {string} apiUrl Script source API base URL.
 * @param {{name: string, tags: string[]}} filters Applied backend filters.
 * @returns {object} Catalogue state and mutation operations.
 */
export function useScriptSources(apiUrl, filters) {
  const [user, setUser] = useState(emptyPage(USER_LIMIT));
  const [userError, setUserError] = useState("");
  const [loading, setLoading] = useState(true);
  const [userOffset, setUserOffset] = useState(0);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);

  useEffect(() => setUserOffset(0), [apiUrl, filterKey]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setUserError("");

    fetchPage(apiUrl, "user", { ...filters, limit: USER_LIMIT, offset: userOffset })
      .then((page) => {
        if (active) setUser(page);
      })
      .catch((error) => {
        if (active) {
          setUser(emptyPage(USER_LIMIT));
          setUserError(messageOf(error));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [apiUrl, filterKey, filters, refreshVersion, userOffset]);

  const refresh = useCallback(() => setRefreshVersion((version) => version + 1), []);
  const getDetail = useCallback(
    (origin, id) => requestJson(`${apiUrl}/${origin}/${encodeURIComponent(id)}`),
    [apiUrl],
  );
  const listBuiltinTemplates = useCallback(
    () => fetchPage(apiUrl, "builtin", { name: "", tags: [], limit: BUILTIN_LIMIT, offset: 0 }),
    [apiUrl],
  );
  const createUser = useCallback(async (script) => {
    const result = await requestJson(`${apiUrl}/user`, { method: "POST", body: JSON.stringify(script) });
    refresh();
    return result;
  }, [apiUrl, refresh]);
  const replaceUser = useCallback(async (id, script) => {
    const result = await requestJson(`${apiUrl}/user/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(script),
    });
    refresh();
    return result;
  }, [apiUrl, refresh]);
  const deleteUser = useCallback(async (id) => {
    await requestJson(`${apiUrl}/user/${encodeURIComponent(id)}`, { method: "DELETE" });
    refresh();
  }, [apiUrl, refresh]);

  return {
    createUser,
    deleteUser,
    getDetail,
    listBuiltinTemplates,
    loading,
    refresh,
    replaceUser,
    setUserOffset,
    user,
    userError,
    userOffset,
  };
}

async function fetchPage(apiUrl, origin, { limit, offset, name, tags }) {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (name.trim()) query.set("name", name.trim());
  tags.forEach((tag) => query.append("tag", tag));
  return requestJson(`${apiUrl}/${origin}?${query}`);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) },
  });
  if (response.status === 204) return null;
  const text = await response.text();
  const body = text ? safeJson(text) : null;
  if (!response.ok) throw new Error(body?.message || body?.detail || `HTTP ${response.status}`);
  return body;
}

function emptyPage(limit) {
  return { items: [], limit, offset: 0, total: 0 };
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function messageOf(error) {
  return error?.message || "Request failed";
}
