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
import { ScriptCodeEditor } from "./ScriptCodeEditor.jsx";

/**
 * Shared script-code editing surface used by the IDE and source dialogs.
 *
 * @param {object} props
 * @param {Array<object>} props.bindings - Runner bindings offered as completions.
 * @param {boolean} [props.flushTop] - Joins the surface to a document tab.
 * @param {(source: string) => void} props.onChange - Receives source changes.
 * @param {string} props.value - Current JavaScript source.
 * @returns {import("react").ReactElement}
 */
export function ScriptEditor({ bindings, flushTop = false, onChange, value }) {
  return (
    <ScriptCodeEditor
      bindings={bindings}
      flushTop={flushTop}
      onChange={onChange}
      value={value}
    />
  );
}
