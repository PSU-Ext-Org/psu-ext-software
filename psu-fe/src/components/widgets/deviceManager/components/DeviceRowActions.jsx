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
import { Settings, Trash2 } from "lucide-react";
import { getConnectionAction } from "./deviceRowPresentation.js";

/** Renders device actions while leaving connection state ownership with the manager. */
export function DeviceRowActions({ connecting, device, manager, status, onDelete, onEdit }) {
  const action = getConnectionAction(status, connecting);

  function handleConnectionAction() {
    const result = action.disconnect
      ? manager.disconnectDevice(device.id)
      : manager.connectDevice(device.id);
    // The manager displays command failures in its device state.
    void Promise.resolve(result).catch(() => {});
  }

  return (
    <>
      <button
        className={action.className}
        disabled={action.disabled}
        onClick={handleConnectionAction}
        type="button"
      >
        {action.label}
      </button>
      <button
        aria-label={`Edit device ${device.name}`}
        className="control-standard border border-slate-200 bg-white p-1.5"
        onClick={() => onEdit(device)}
        type="button"
      >
        <Settings className="h-3.5 w-3.5" />
      </button>
      <button
        aria-label={`Delete device ${device.name}`}
        className="control-standard border border-rose-200 bg-white p-1.5 text-rose-700"
        onClick={() => onDelete(device)}
        type="button"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </>
  );
}
