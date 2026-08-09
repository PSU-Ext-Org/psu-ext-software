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
import packageJson from "../../../../package.json";

/**
 * Shared footer shown below every routed page.
 *
 * @returns {import("react").ReactElement}
 */
export function AppFooter() {
  return (
    <footer className="mx-auto flex max-w-6xl justify-end gap-3 px-6 pb-4 text-sm text-slate-600">
      <span>Created by MaxEELabs</span>
      <span>{`v${packageJson.version}`}</span>
    </footer>
  );
}
