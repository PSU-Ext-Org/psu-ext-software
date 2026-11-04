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
 * Describes a positioned dashboard widget.
 *
 * @typedef {object} WidgetPlacement
 * @property {string} id
 * @property {string} type
 * @property {number} x
 * @property {number} y
 * @property {1 | 2 | 3} w
 * @property {1 | 2 | 3} h
 */

/**
 * Describes the React content rendered for a dashboard widget type.
 *
 * @typedef {object} WidgetDefinition
 * @property {string | import("react").ComponentType<{placement: WidgetPlacement}>} title
 * @property {string} [text]
 * @property {import("react").ComponentType<{className?: string}>} [icon]
 * @property {import("react").ComponentType<{placement: WidgetPlacement}>} [actions]
 * @property {import("react").ComponentType<{placement: WidgetPlacement}>} render
 * @property {import("react").ComponentType<{placement: WidgetPlacement}>} [status]
 */

/**
 * Describes a widget variant a user can add to an editable dashboard.
 *
 * @typedef {object} AvailableWidget
 * @property {string} type
 * @property {string} label
 * @property {string} [idPrefix]
 * @property {number} [w]
 * @property {number} [h]
 */

/**
 * Initial widget positions, settings, and dashboard grid geometry.
 *
 * @typedef {object} DashboardLayout
 * @property {Array<WidgetPlacement>} defaultLayout
 * @property {Record<string, object>} [defaultWidgetConfigs]
 * @property {number} [columns] - Number of horizontal grid slots.
 * @property {number} [rowHeight] - Pixel height of one grid row.
 * @property {string} [gridTemplateRows] - Explicit CSS grid-template-rows value.
 */

/**
 * Widget registry and dashboard edit policy.
 *
 * @typedef {object} DashboardWidgets
 * @property {Record<string, WidgetDefinition>} definitions - Renderers keyed by widget type.
 * @property {Array<AvailableWidget>} [available] - Widget variants users can add.
 * @property {boolean} [editable] - Whether users can edit the dashboard layout.
 */

export {};
