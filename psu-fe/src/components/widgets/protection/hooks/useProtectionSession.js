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
import { useEffect, useMemo, useRef } from "react";

/** Provides one request version shared by reads and writes; unmount invalidates every request. */
export function useProtectionSession() {
  const versionRef = useRef(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      versionRef.current += 1;
    };
  }, []);

  return useMemo(() => ({
    capture: () => versionRef.current,
    advance: () => ++versionRef.current,
    isCurrent: (version) => mountedRef.current && versionRef.current === version,
  }), []);
}

/** Identifies the configuration and connection changes that invalidate device-derived state. */
export function getProtectionSessionKey(config, runnable) {
  return JSON.stringify([
    config.channel,
    config.deviceName,
    config.disabledResponse,
    config.enableOffCommand,
    config.enableOnCommand,
    config.enableQuery,
    config.enabledResponse,
    config.protectionKey,
    config.tripQuery,
    config.valueSetTemplate,
    config.valueQuery,
    runnable,
  ]);
}
