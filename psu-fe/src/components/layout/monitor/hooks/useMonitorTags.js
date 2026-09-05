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
import { useEffect, useMemo, useState } from "react";
import {
  abbreviateMonitorUuids,
  extractMonitorTags,
  filterMonitorByTags,
} from "../../../../connection/ws-proxy/monitor/monitorLog.js";
import { MONITOR_TAG } from "../../../../connection/ws-proxy/monitor/monitorTagQueue.js";

/**
 * Derives monitor tags and owns the active tag-filter selection.
 *
 * @param {string} wsMessages - Complete WebSocket log text.
 * @param {(() => string[]) | undefined} getWsTags - Optional connection-provided tag selector.
 * @returns {object} Filter view model, rendered log text, and user-tag inclusion action.
 */
export function useMonitorTags(wsMessages, getWsTags) {
  const [selectedTags, setSelectedTags] = useState([]);
  const availableTags = useMemo(
    () => (getWsTags ? getWsTags() : extractMonitorTags(wsMessages)),
    [getWsTags, wsMessages],
  );
  const availableTagsKey = availableTags.join("\n");
  const selectedTagSet = useMemo(() => new Set(selectedTags), [selectedTags]);
  const visibleTags = useMemo(
    () => availableTags.filter((tag) => !selectedTagSet.has(tag)),
    [availableTags, selectedTagSet],
  );
  const displayedMessages = useMemo(
    () => abbreviateMonitorUuids(filterMonitorByTags(wsMessages, selectedTags)),
    [selectedTags, wsMessages],
  );
  const text = getMonitorText(wsMessages, selectedTags, displayedMessages);

  useEffect(() => {
    setSelectedTags((current) => {
      const next = current.filter((tag) => tag === MONITOR_TAG.USER || availableTags.includes(tag));
      return next.length === current.length ? current : next;
    });
  }, [availableTags, availableTagsKey]);

  function addTag(tag) {
    setSelectedTags((current) => (current.includes(tag) ? current : [...current, tag]));
  }

  function removeTag(tag) {
    setSelectedTags((current) => current.filter((selectedTag) => selectedTag !== tag));
  }

  function clearTags() {
    setSelectedTags([]);
  }

  function includeUserTag() {
    setSelectedTags([MONITOR_TAG.USER]);
  }

  return {
    filters: {
      add: addTag,
      available: availableTags,
      clear: clearTags,
      remove: removeTag,
      selected: selectedTags,
      visible: visibleTags,
    },
    includeUserTag,
    text,
  };
}

/**
 * Creates the empty-state text for the current log and active filters.
 *
 * @param {string} wsMessages - Unfiltered WebSocket log text.
 * @param {string[]} selectedTags - Active monitor tag filters.
 * @param {string} displayedMessages - Filtered and abbreviated log text.
 * @returns {string} Text rendered by the log viewport.
 */
function getMonitorText(wsMessages, selectedTags, displayedMessages) {
  if (!wsMessages) {
    return "No websocket messages yet.";
  }

  if (selectedTags.length && !displayedMessages) {
    return "No messages for selected tags.";
  }

  return displayedMessages;
}
