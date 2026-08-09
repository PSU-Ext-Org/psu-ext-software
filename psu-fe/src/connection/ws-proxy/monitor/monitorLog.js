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
import { formatMonitorTimestamp } from "./monitorTime.js";

export const MAX_MONITOR_BYTES = 128 * 1024;
export const MAX_MONITOR_LINES = 1_000;

/**
 * Formats one monitor line.
 *
 * @param {string} direction - Message category, such as `in`, `out`, or `error`.
 * @param {string} message - Message text.
 * @param {string} tag - Frontend-specific source tag, such as `SYSTEM` or `USER`.
 * @param {string} [uuid] - Request UUID associated with the message.
 * @param {Date} [date] - Timestamp source.
 * @returns {string}
 */
export function formatMonitorLine(direction, message, tag = "SYSTEM", uuid = "", date = new Date()) {
  const uuidPrefix = uuid ? `[${uuid}] ` : "";
  return `[${formatMonitorTimestamp(date)}] [${tag}] ${formatDirection(direction)} ${uuidPrefix}${message}\n`;
}

/**
 * Extracts unique monitor tags from formatted monitor text.
 *
 * @param {string} value - Monitor contents.
 * @returns {string[]}
 */
export function extractMonitorTags(value) {
  const tags = new Set();

  for (const line of splitMonitorLines(value)) {
    const tag = parseMonitorTag(line);
    if (tag) {
      tags.add(tag);
    }
  }

  return [...tags].sort();
}

/**
 * Keeps only monitor lines whose tag is selected.
 *
 * An empty selected tag list means no filtering.
 *
 * @param {string} value - Monitor contents.
 * @param {string[]} selectedTags - Tags to keep.
 * @returns {string}
 */
export function filterMonitorByTags(value, selectedTags) {
  if (!selectedTags.length) {
    return value;
  }

  const selectedTagSet = new Set(selectedTags);

  return splitMonitorLines(value)
    .filter((line) => selectedTagSet.has(parseMonitorTag(line)))
    .join("");
}

/**
 * Shortens visible monitor UUIDs to the first UUID segment for compact GUI display.
 *
 * Stored monitor text is left unchanged so downloads retain full UUIDs.
 *
 * @param {string} value - Monitor contents.
 * @returns {string}
 */
export function abbreviateMonitorUuids(value) {
  return String(value).replace(/\[([0-9a-f]{8})-[0-9a-f-]+\]/gi, "[$1]");
}

/**
 * Keeps only the latest monitor content when the log grows too large.
 *
 * @param {string} value - Monitor contents.
 * @returns {string}
 */
export function trimMonitor(value) {
  const sizeTrimmed = value.length <= MAX_MONITOR_BYTES
    ? value
    : value.slice(value.length - MAX_MONITOR_BYTES);
  const lines = splitMonitorLines(sizeTrimmed);

  if (lines.length <= MAX_MONITOR_LINES) {
    return sizeTrimmed;
  }

  return lines.slice(lines.length - MAX_MONITOR_LINES).join("");
}

/**
 * Creates a bounded monitor line buffer optimized for append-heavy WebSocket logs.
 *
 * @returns {{
 *   append: (line: string) => void,
 *   clear: () => void,
 *   getText: () => string,
 *   getTags: () => string[]
 * }}
 */
export function createMonitorBuffer() {
  const lines = [];
  const tagCounts = new Map();
  let text = "";
  let size = 0;

  function append(line) {
    const nextLines = splitMonitorLines(trimMonitor(String(line)));
    for (const nextLine of nextLines) {
      lines.push(nextLine);
      size += nextLine.length;
      incrementTag(parseMonitorTag(nextLine));
    }

    trimStoredLines();
    text = lines.join("");
  }

  function clear() {
    lines.length = 0;
    tagCounts.clear();
    text = "";
    size = 0;
  }

  function trimStoredLines() {
    while (lines.length > MAX_MONITOR_LINES || size > MAX_MONITOR_BYTES) {
      const removed = lines.shift();
      if (!removed) {
        break;
      }

      size -= removed.length;
      decrementTag(parseMonitorTag(removed));
    }
  }

  function incrementTag(tag) {
    if (!tag) {
      return;
    }

    tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  }

  function decrementTag(tag) {
    if (!tag) {
      return;
    }

    const nextCount = (tagCounts.get(tag) || 0) - 1;
    if (nextCount > 0) {
      tagCounts.set(tag, nextCount);
    } else {
      tagCounts.delete(tag);
    }
  }

  return {
    append,
    clear,
    getText: () => text,
    getTags: () => [...tagCounts.keys()].sort(),
  };
}

function splitMonitorLines(value) {
  return value.match(/[^\n]*\n|[^\n]+/g) ?? [];
}

function parseMonitorTag(line) {
  return line.match(/^\[[^\]]+\] \[([^\]]+)\] /)?.[1] ?? "";
}

function formatDirection(direction) {
  const normalized = String(direction || "").toUpperCase();
  return normalized === "IN" ? "IN_" : normalized;
}
