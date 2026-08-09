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
export const EMPTY_SCRIPT_SOURCE = "(() => {\n  \n})();\n";

/** Normalises partially populated API payloads into an editable script document. */
export function normaliseScript(script = {}) {
  return {
    name: script.name || "",
    tags: script.tags || [],
    sourceCode: script.sourceCode || EMPTY_SCRIPT_SOURCE,
  };
}

/** Removes empty and duplicate source tags while preserving their order. */
export function parseTags(tags) {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

/** Validates the Script Runner's required self-executing function wrapper. */
export function validateWrappedScript(source) {
  const outerCommentsOrWhitespace = String.raw`(?:\s+|//[^\r\n]*(?:\r?\n|$)|/\*[\s\S]*?\*/)*`;
  const wrappedScript = new RegExp(
    String.raw`^${outerCommentsOrWhitespace}\(\s*\(\s*\)\s*=>\s*\{[\s\S]*\}\s*\)\s*\(\s*\)\s*;?${outerCommentsOrWhitespace}$`,
  );
  if (!wrappedScript.test(source)) return "Scripts must use the built-in (() => { … })(); wrapper.";
  try {
    // Compiling checks syntax but does not execute the submitted script.
    new Function(`"use strict";\n${source}`);
    return "";
  } catch (error) {
    return error.message || "Script has invalid JavaScript syntax.";
  }
}

export function fileNameToTitle(fileName) {
  return fileName.replace(/\.js$/i, "") || fileName;
}

export function scriptFileName(scriptName) {
  const name = scriptName.trim() || "New Script";
  return /\.js$/i.test(name) ? name : `${name}.js`;
}

export function shortScriptId(id) {
  return String(id).slice(0, 5);
}
