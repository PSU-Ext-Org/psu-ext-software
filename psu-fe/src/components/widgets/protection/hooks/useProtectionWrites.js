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
import { useCallback } from "react";
import { formatConfiguredValue, validateDraftThreshold } from "../utils/protectionHelpers.js";
import { sendProtectionCommand } from "../utils/protectionRuntime.js";

/** Writes protection settings and verifies them only while the originating session remains current. */
export function useProtectionWrites({
  config, runnable, runtime, draftValue, setDraftValue, setRuntime,
  sendScpiCommand, refreshRuntime, session,
}) {
  const handleApplyThreshold = useCallback(async () => {
    const error = validateDraftThreshold(draftValue, config, runtime.loading);
    if (!runnable || error) {
      return;
    }

    const normalizedValue = formatConfiguredValue(draftValue, config.decimals);
    const requestVersion = session.capture();
    setRuntime((current) => ({ ...current, loading: true, error: "" }));

    try {
      await sendProtectionCommand(
        sendScpiCommand,
        config.deviceName,
        config.valueSetTemplate.replace("{value}", normalizedValue),
      );
      if (!session.isCurrent(requestVersion)) {
        return;
      }
      setDraftValue("");
      await refreshRuntime("write-verify");
    } catch (error) {
      if (!session.isCurrent(requestVersion)) {
        return;
      }
      setRuntime((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Threshold update failed.",
      }));
    }
  }, [config, draftValue, refreshRuntime, runnable, runtime.loading, sendScpiCommand, session, setDraftValue, setRuntime]);

  const handleToggleEnabled = useCallback(async () => {
    if (!runnable) {
      return;
    }
    const requestVersion = session.capture();
    const command =
      runtime.enabledState === "enabled" ? config.enableOffCommand : config.enableOnCommand;
    setRuntime((current) => ({ ...current, loading: true, error: "" }));

    try {
      await sendProtectionCommand(sendScpiCommand, config.deviceName, command);
      if (!session.isCurrent(requestVersion)) {
        return;
      }
      await refreshRuntime("write-verify");
    } catch (error) {
      if (!session.isCurrent(requestVersion)) {
        return;
      }
      setRuntime((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Enable update failed.",
      }));
    }
  }, [config, refreshRuntime, runnable, runtime.enabledState, sendScpiCommand, session, setRuntime]);

  return { handleApplyThreshold, handleToggleEnabled };
}
