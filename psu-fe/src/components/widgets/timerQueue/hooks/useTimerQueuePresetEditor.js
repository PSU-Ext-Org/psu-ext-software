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
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getTimerQueueConfigLimits,
  getTimerQueueValidationIssue,
  saveTimerQueueControlConfig,
} from "../timerQueueConfig.js";

const TIMER_ID_LENGTH = getTimerQueueConfigLimits().timerIdLength;

/**
 * Owns timer-preset draft state independently from card metadata updates.
 *
 * @param {{
 *   config: {timers: Array<object>},
 *   setConfig: (config: object) => void,
 *   widgetId: string,
 * }} options - Persisted widget configuration and its storage adapter.
 * @returns {{
 *   addTimer: (timer: object) => void,
 *   deleteTimer: (index: number) => void,
 *   dirty: boolean,
 *   draftTimers: Array<object>,
 *   draftValidation: {message: string, rowIndex?: number, field?: string} | null,
 *   savePreset: () => void,
 *   updateTimer: (index: number, key: string, value: unknown) => void,
 * }} Timer-preset editor model.
 */
export function useTimerQueuePresetEditor({ config, setConfig, widgetId }) {
  const [draftTimers, setDraftTimers] = useState(config.timers);
  const persistedTimersSignature = JSON.stringify(config.timers);
  const previousPersistedTimersSignatureRef = useRef(persistedTimersSignature);

  useEffect(() => {
    if (previousPersistedTimersSignatureRef.current === persistedTimersSignature) {
      return;
    }

    previousPersistedTimersSignatureRef.current = persistedTimersSignature;
    setDraftTimers(config.timers);
  }, [config.timers, persistedTimersSignature]);

  const addTimer = useCallback((timer) => {
    setDraftTimers((current) => [...current, timer]);
  }, []);

  const deleteTimer = useCallback((index) => {
    setDraftTimers((current) => current.filter((_, timerIndex) => timerIndex !== index));
  }, []);

  const updateTimer = useCallback((index, key, value) => {
    setDraftTimers((current) => current.map((timer, timerIndex) => (
      timerIndex === index
        ? {
          ...timer,
          [key]: key === "id" ? String(value).slice(0, TIMER_ID_LENGTH) : value,
        }
        : timer
    )));
  }, []);

  const savePreset = useCallback(() => {
    setConfig(saveTimerQueueControlConfig(widgetId, { ...config, timers: draftTimers }));
  }, [config, draftTimers, setConfig, widgetId]);

  return {
    addTimer,
    deleteTimer,
    dirty: JSON.stringify(config.timers) !== JSON.stringify(draftTimers),
    draftTimers,
    draftValidation: getTimerQueueValidationIssue({ ...config, timers: draftTimers }),
    savePreset,
    updateTimer,
  };
}
