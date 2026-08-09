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
export const MONITOR_TAG = Object.freeze({
  SYSTEM: "SYSTEM",
  USER: "USER",
  GUI: "GUI",
  SCHEDULER: "SCHEDULER",
});

/**
 * Creates a UUID-keyed store that tracks which monitor tag should be applied
 * to each inbound response.
 *
 * @returns {{
 *   track: (uuid: string, tag: string) => void,
 *   consume: (uuid: string) => string,
 *   clear: () => void
 * }}
 */
export function createMonitorTagQueue() {
  let tagsByUuid = new Map();

  return {
    track(uuid, tag) {
      if (!uuid) {
        return;
      }
      tagsByUuid.set(uuid, tag || MONITOR_TAG.SYSTEM);
    },
    consume(uuid) {
      if (!uuid) {
        return MONITOR_TAG.SYSTEM;
      }

      const tag = tagsByUuid.get(uuid) || MONITOR_TAG.SYSTEM;
      tagsByUuid.delete(uuid);
      return tag;
    },
    clear() {
      tagsByUuid = new Map();
    },
  };
}
