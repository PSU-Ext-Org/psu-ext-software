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
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Field } from "../../../forms/Field.jsx";
import { SelectField } from "../../../forms/SelectField.jsx";
import { Modal } from "../../../layout/dialogs/Modal.jsx";

/**
 * Displays the shared add or edit device form.
 *
 * @param {{device?: object | null, manager: object, onClose: Function}} props
 * @returns {import("react").ReactElement}
 */
export function DeviceFormModal({ device = null, manager, onClose }) {
  const editing = Boolean(device);
  const [name, setName] = useState(device?.name || "");
  const [type, setType] = useState(device?.type || "TCP");
  const [ip, setIp] = useState(device?.ip || "");
  const [port, setPort] = useState(device?.port || "");
  const [baudrate, setBaudrate] = useState(device?.baudrate || "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = /^[A-Z0-9]{1,8}$/.test(name)
    && (type === "TCP" ? Boolean(ip && port) : Boolean(port && baudrate));

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const profile = { name, type, ip, port, baudrate };
      if (editing) {
        await manager.modifyDevice(device.id, profile);
      } else {
        await manager.addDevice(profile);
      }
      onClose();
    } catch (requestError) {
      setError(requestError.message || String(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={editing ? `Edit Device — ${device.name}` : "Add Device"} onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        <Field label="Name" value={name} onChange={(value) => setName(value.toUpperCase())} />
        <SelectField
          label="Type"
          options={[{ value: "TCP", label: "TCP" }, { value: "USB", label: "USB" }]}
          value={type}
          onChange={setType}
        />
        {type === "TCP" ? (
          <>
            <Field label="IP" value={ip} onChange={setIp} />
            <Field label="Port" value={port} onChange={setPort} />
          </>
        ) : (
          <>
            <Field label="COM Port" value={port} onChange={setPort} />
            <Field label="Baudrate" value={baudrate} onChange={setBaudrate} />
          </>
        )}
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        <button
          className="control-standard inline-flex items-center justify-center bg-teal-700 px-3 font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          disabled={!canSubmit || submitting}
          type="submit"
        >
          {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : editing ? "Save Changes" : "Add Device"}
        </button>
      </form>
    </Modal>
  );
}
