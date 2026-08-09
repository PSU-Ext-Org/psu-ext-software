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
/**
 * Creates a unique id for a persisted dashboard layout.
 *
 * @returns {string}
 */
export function createLayoutId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `layout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Creates a unique widget id scoped to a dashboard page and widget type.
 *
 * @param {object} options
 * @param {string} options.pageId
 * @param {string} options.type
 * @param {string} [options.idPrefix]
 * @returns {string}
 */
export function createWidgetId({ pageId, type, idPrefix }) {
  const prefix = idPrefix || `${type}-${pageId}`;
  if (window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID().slice(0, 8)}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
