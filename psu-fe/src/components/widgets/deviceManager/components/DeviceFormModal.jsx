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

const DEVICE_NAME_RULE = "Use 1 to 8 letters or digits for the device name.";

/** Checks a positive decimal integer against the backend's field limit. */
function isPositiveIntegerWithin(value, max) {
  const number = Number(value);
  return /^\+?[0-9]+$/.test(value) && number >= 1 && number <= max;
}

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
  const [ip, setIp] = useState(device?.type === "TCP" ? device.ip ?? "" : "");
  const [tcpPort, setTcpPort] = useState(device?.type === "TCP" ? String(device.port ?? "") : "");
  const [usbPort, setUsbPort] = useState(device?.type === "USB" ? String(device.port ?? "") : "");
  const [baudrate, setBaudrate] = useState(device?.type === "USB" ? String(device.baudrate ?? "") : "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isTcp = type === "TCP";
  const trimmedName = name.trim();
  const trimmedIp = ip.trim();
  const trimmedTcpPort = tcpPort.trim();
  const trimmedUsbPort = usbPort.trim();
  const trimmedBaudrate = baudrate.trim();
  const validName = /^[A-Z0-9]{1,8}$/.test(trimmedName);
  const validTcpPort = isPositiveIntegerWithin(trimmedTcpPort, 65535);
  const validBaudrate = isPositiveIntegerWithin(trimmedBaudrate, 2_147_483_647);
  const canSubmit = validName && (isTcp ? trimmedIp !== "" && validTcpPort : trimmedUsbPort !== "" && validBaudrate);

  async function submit(event) {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const profile = {
        name: trimmedName,
        type,
        ip: isTcp ? trimmedIp : "",
        port: isTcp ? trimmedTcpPort : trimmedUsbPort,
        baudrate: isTcp ? "" : trimmedBaudrate,
      };
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
        <Field
          label="Name"
          placeholder="PSUEXT1"
          value={name}
          onChange={(value) => setName(value.toUpperCase())}
          hint={name ? "" : DEVICE_NAME_RULE}
          errorMessage={name && !validName ? DEVICE_NAME_RULE : ""}
          required
        />
        <SelectField
          label="Type"
          options={[{ value: "TCP", label: "TCP" }, { value: "USB", label: "USB" }]}
          value={type}
          onChange={setType}
          required
        />
        {isTcp ? (
          <>
            <Field
              label="IP"
              placeholder="192.168.4.1"
              value={ip}
              onChange={setIp}
              errorMessage={ip && !trimmedIp ? "Enter an IP address or hostname." : ""}
              required
            />
            <Field
              label="Port"
              placeholder="5025"
              value={tcpPort}
              onChange={setTcpPort}
              errorMessage={tcpPort && !validTcpPort ? "Enter a whole number from 1 to 65535." : ""}
              required
            />
          </>
        ) : (
          <>
            <Field
              label="COM Port"
              placeholder="COM3"
              value={usbPort}
              onChange={setUsbPort}
              errorMessage={usbPort && !trimmedUsbPort ? "Enter a serial port." : ""}
              required
            />
            <Field
              label="Baudrate"
              placeholder="9600"
              value={baudrate}
              onChange={setBaudrate}
              errorMessage={baudrate && !validBaudrate ? "Enter a whole number from 1 to 2147483647." : ""}
              required
            />
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
