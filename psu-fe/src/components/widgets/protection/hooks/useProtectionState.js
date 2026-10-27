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
import { useCallback, useReducer } from "react";
import { INITIAL_RUNTIME_STATE } from "../utils/protectionHelpers.js";

function groupRuntime(runtime) {
  const { thresholdValue, enabledState, tripped, lastUpdatedAt, loading, error, pollError } = runtime;
  return {
    readings: { thresholdValue, enabledState, tripped, lastUpdatedAt },
    activity: { loading, error, pollError },
  };
}

function updateRuntime(state, update) {
  const current = { ...state.readings, ...state.activity };
  return groupRuntime(typeof update === "function" ? update(current) : update);
}

/** Separates readings from request activity while preserving the widget's flat runtime API. */
export function useProtectionState() {
  const [state, dispatch] = useReducer(updateRuntime, INITIAL_RUNTIME_STATE, groupRuntime);
  const setRuntime = useCallback((update) => dispatch(update), []);
  return [{ ...state.readings, ...state.activity }, setRuntime];
}
