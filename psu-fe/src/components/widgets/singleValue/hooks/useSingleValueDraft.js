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
import { useCallback, useState } from "react";

const TARGET_FIELDS = ["deviceName", "query", "frequencyHz"];
const APPEARANCE_FIELDS = ["unit", "cardName", "valueColor"];

/** Keeps editable settings in cohesive groups without changing the persisted config shape. */
export function useSingleValueDraft(config) {
  const [target, setTarget] = useState(() => pick(config, TARGET_FIELDS));
  const [appearance, setAppearance] = useState(() => pick(config, APPEARANCE_FIELDS));

  const resetDraft = useCallback((nextConfig) => {
    setTarget(pick(nextConfig, TARGET_FIELDS));
    setAppearance(pick(nextConfig, APPEARANCE_FIELDS));
  }, []);

  const updateDraft = useCallback((key, value) => {
    if (TARGET_FIELDS.includes(key)) {
      setTarget((current) => ({ ...current, [key]: value }));
    }
    if (APPEARANCE_FIELDS.includes(key)) {
      setAppearance((current) => ({ ...current, [key]: value }));
    }
  }, []);

  return {
    draft: { ...config, ...target, ...appearance },
    resetDraft,
    updateDraft,
  };
}

function pick(config, keys) {
  return Object.fromEntries(keys.map((key) => [key, config[key]]));
}
