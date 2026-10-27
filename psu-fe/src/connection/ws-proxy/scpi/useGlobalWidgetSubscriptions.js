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
import { useEffect, useRef } from "react";
import { WIDGET_CONFIG_CHANGE_EVENT } from "../../../components/widgets/widgetConfigStore.js";
import { getAllRunnableWidgetSubscriptions } from "../../../components/widgets/widgetConfigRegistry.js";

/** Bridges saved widget configuration into polling even when widgets are unmounted. */
export function useGlobalWidgetSubscriptions(subscribeScpiQuery) {
  const globalScpiUnsubscribersRef = useRef([]);
  useEffect(() => {
    function syncGlobalWidgetSubscriptions() {
      for (const unsubscribe of globalScpiUnsubscribersRef.current) {
        unsubscribe();
      }

      globalScpiUnsubscribersRef.current = getAllRunnableWidgetSubscriptions()
        .map((subscription) => subscribeScpiQuery(subscription));
    }

    syncGlobalWidgetSubscriptions();
    window.addEventListener(WIDGET_CONFIG_CHANGE_EVENT, syncGlobalWidgetSubscriptions);
    window.addEventListener("storage", syncGlobalWidgetSubscriptions);

    return () => {
      window.removeEventListener(WIDGET_CONFIG_CHANGE_EVENT, syncGlobalWidgetSubscriptions);
      window.removeEventListener("storage", syncGlobalWidgetSubscriptions);
      for (const unsubscribe of globalScpiUnsubscribersRef.current) {
        unsubscribe();
      }
      globalScpiUnsubscribersRef.current = [];
    };
  }, [subscribeScpiQuery]);
}
