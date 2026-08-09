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
/**
 * Displays a neutral connection-state message in the device manager.
 *
 * @param {{children: import("react").ReactNode}} props
 * @returns {import("react").ReactElement}
 */
export function ConnectionMessage({ children }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}
