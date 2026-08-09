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
import { useState } from "react";
import { Modal } from "../../../layout/dialogs/Modal.jsx";

/**
 * Confirms removal of a configured device.
 *
 * @param {{device: object, manager: object, onClose: Function}} props
 * @returns {import("react").ReactElement}
 */
export function DeleteDeviceDialog({ device, manager, onClose }) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function confirm() {
    setSubmitting(true);
    try {
      await manager.deleteDevice(device.id);
      onClose();
    } catch (requestError) {
      setError(requestError.message || String(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Delete Device" onClose={onClose}>
      <div className="grid gap-4">
        <p>Delete device <strong>{device.name}</strong>?</p>
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        <button
          className="control-standard bg-rose-600 text-white disabled:opacity-50"
          disabled={submitting}
          onClick={confirm}
          type="button"
        >
          Delete
        </button>
      </div>
    </Modal>
  );
}
