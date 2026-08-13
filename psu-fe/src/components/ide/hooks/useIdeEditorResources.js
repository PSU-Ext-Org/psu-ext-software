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

import { sortBuiltinTemplates } from "../../widgets/scriptSources/utils/sortBuiltinTemplates.js";

/** Loads independent completion and template resources used by the editor. */
export function useIdeEditorResources({ loadBindings, loadBuiltinTemplates, onError }) {
  const [bindings, setBindings] = useState([]);
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    let active = true;

    loadBuiltinTemplates()
      .then((page) => {
        if (active) setTemplates(sortBuiltinTemplates(page.items || []));
      })
      .catch((requestError) => {
        if (active) onError(requestError.message || "Could not load built-in scripts.");
      });

    loadBindings()
      .then((response) => {
        if (active) setBindings(response.items || []);
      })
      .catch(() => {
        if (active) onError("Runner completions are unavailable. JavaScript editing is still available.");
      });

    return () => {
      active = false;
    };
  }, [loadBindings, loadBuiltinTemplates, onError]);

  return { bindings, templates };
}
