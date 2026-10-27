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
import { useEffect, useState } from "react";
import { INITIAL_RUNTIME_STATE } from "../utils/protectionHelpers.js";
import { missingSendScpiCommand } from "../utils/protectionRuntime.js";
import { useProtectionReadings } from "./useProtectionReadings.js";
import { useProtectionSession, getProtectionSessionKey } from "./useProtectionSession.js";
import { useProtectionState } from "./useProtectionState.js";
import { useProtectionWrites } from "./useProtectionWrites.js";

/** Composes protection reads and writes under one connection-scoped request lifetime. */
export function useProtectionRuntime({
  config,
  placementId,
  runnable,
  sendScpiCommand = missingSendScpiCommand,
}) {
  const [runtime, setRuntime] = useProtectionState();
  const [draftValue, setDraftValue] = useState("");
  const session = useProtectionSession();
  const sessionKey = getProtectionSessionKey(config, runnable);

  useEffect(() => {
    session.advance();
    setDraftValue("");
    setRuntime(INITIAL_RUNTIME_STATE);
  }, [session, sessionKey, setRuntime]);

  const refreshRuntime = useProtectionReadings({
    config, placementId, runnable, sendScpiCommand, session, sessionKey, setRuntime,
  });
  const actions = useProtectionWrites({
    config, runnable, runtime, draftValue, setDraftValue, setRuntime,
    sendScpiCommand, refreshRuntime, session,
  });

  return {
    draftValue,
    ...actions,
    runtime: runnable ? runtime : INITIAL_RUNTIME_STATE,
    setDraftValue,
  };
}
