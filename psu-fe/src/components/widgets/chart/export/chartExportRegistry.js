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
import { useCallback, useEffect, useSyncExternalStore } from "react";

const EMPTY_EXPORT = Object.freeze({ exportPng: null, ready: false, supported: false });
const exportsById = new Map();
const listenersById = new Map();

/**
 * Publishes a mounted renderer's image-export capability.
 *
 * @param {string} exportId
 * @param {{exportPng?: (() => Promise<void>) | null, ready?: boolean, supported?: boolean}} descriptor
 * @returns {() => void}
 */
export function registerChartImageExport(exportId, descriptor) {
  if (!exportId) return () => {};

  const entry = Object.freeze({
    exportPng: typeof descriptor?.exportPng === "function" ? descriptor.exportPng : null,
    ready: Boolean(descriptor?.ready),
    supported: Boolean(descriptor?.supported),
  });
  exportsById.set(exportId, entry);
  emit(exportId);

  return () => {
    if (exportsById.get(exportId) === entry) {
      exportsById.delete(exportId);
      emit(exportId);
    }
  };
}

/**
 * Keeps one renderer registered while its readiness changes.
 *
 * @param {string} exportId
 * @param {{exportPng?: (() => Promise<void>) | null, ready?: boolean, supported?: boolean}} descriptor
 */
export function useRegisterChartImageExport(exportId, descriptor) {
  const exportPng = descriptor?.exportPng || null;
  const ready = Boolean(descriptor?.ready);
  const supported = Boolean(descriptor?.supported);

  useEffect(
    () => registerChartImageExport(exportId, { exportPng, ready, supported }),
    [exportId, exportPng, ready, supported],
  );
}

/**
 * Subscribes a header action to its corresponding mounted renderer.
 *
 * @param {string} exportId
 * @returns {{exportPng: (() => Promise<void>) | null, ready: boolean, supported: boolean}}
 */
export function useChartImageExport(exportId) {
  const subscribe = useCallback((listener) => subscribeToExport(exportId, listener), [exportId]);
  const getSnapshot = useCallback(() => exportsById.get(exportId) || EMPTY_EXPORT, [exportId]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Clears module state between isolated tests. */
export function clearChartImageExportsForTests() {
  exportsById.clear();
  for (const exportId of listenersById.keys()) emit(exportId);
}

function subscribeToExport(exportId, listener) {
  if (!exportId) return () => {};
  const listeners = listenersById.get(exportId) || new Set();
  listeners.add(listener);
  listenersById.set(exportId, listeners);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) listenersById.delete(exportId);
  };
}

function emit(exportId) {
  for (const listener of listenersById.get(exportId) || []) listener();
}
