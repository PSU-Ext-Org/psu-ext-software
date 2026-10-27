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
import { Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useModalDialog } from "../../../layout/hooks/useModalDialog.js";
import { useWebSocketConnection } from "../../../../connection/ws-proxy/WebSocketConnectionContext.jsx";
import { connectedDevices } from "../../../../connection/ws-proxy/device/deviceRegistry.js";
import { saveSingleToggleConfig, useSingleToggleConfig } from "../singleToggleConfig.js";
import { useSingleToggleDraft } from "../hooks/useSingleToggleDraft.js";
import { validateDraft } from "../utils/singleTogglePresentation.js";
import { SingleToggleSettingsFields } from "./SingleToggleSettingsFields.jsx";
import { ValidationMessage } from "../../../forms/ValidationMessage.jsx";

/** Opens and saves settings for one persisted singleToggle widget. */
export function SingleToggleSettingsButton({ iconOnly = false, placement }) {
  const { devices = [], deviceStatuses = {} } = useWebSocketConnection();
  const [config, setConfig] = useSingleToggleConfig(placement.id);
  const [open, setOpen] = useState(false);
  const { draft, resetDraft, updateDraft } = useSingleToggleDraft(config);
  const dialogRef = useModalDialog(open, () => setOpen(false));
  const connectedTargets = useMemo(
    () => connectedDevices(devices, deviceStatuses),
    [devices, deviceStatuses],
  );
  const deviceOptions = useMemo(
    () => (devices.length ? devices : connectedTargets),
    [connectedTargets, devices],
  );
  const errors = useMemo(() => validateDraft(draft), [draft]);

  useEffect(() => {
    if (!open) {
      resetDraft(config);
    }
  }, [config, open, resetDraft]);

  function handleSubmit(event) {
    event.preventDefault();
    if (errors.length) {
      return;
    }
    setConfig(saveSingleToggleConfig(placement.id, draft));
    setOpen(false);
  }

  return (
    <>
      <button
        aria-label={iconOnly ? "Configure single toggle card" : undefined}
        className={
          iconOnly
            ? "inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
            : "control-standard inline-flex w-full items-center justify-center gap-2 bg-teal-700 font-medium text-white hover:bg-teal-800"
        }
        onClick={() => setOpen(true)}
        onPointerDown={(event) => event.stopPropagation()}
        type="button"
      >
        <Settings className="h-4 w-4" />
        {iconOnly ? <span className="sr-only">Configure</span> : "Configure"}
      </button>

      {open ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6"
          onPointerDown={(event) => event.stopPropagation()}
          role="dialog"
          ref={dialogRef}
        >
          <form
            className="grid w-full max-w-lg gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
            onSubmit={handleSubmit}
          >
            <div className="flex min-w-0 items-start justify-between gap-4">
              <h3 className="text-lg font-semibold text-slate-950">Single Toggle Settings</h3>
              <button
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <SingleToggleSettingsFields
              draft={draft}
              deviceOptions={deviceOptions}
              updateDraft={updateDraft}
            />

            <ValidationMessage message={errors[0]} />

            <div className="flex justify-end gap-2">
              <button
                className="control-standard border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="control-standard bg-teal-700 font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                disabled={errors.length > 0}
                type="submit"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
