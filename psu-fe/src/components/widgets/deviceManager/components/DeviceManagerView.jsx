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
import { useEffect, useMemo, useState } from "react";
import { DeleteDeviceDialog } from "./DeleteDeviceDialog.jsx";
import { DeviceFormModal } from "./DeviceFormModal.jsx";
import { DeviceTable } from "./DeviceTable.jsx";
import { ConnectionMessage } from "./ConnectionMessage.jsx";

/**
 * Renders a normalized device manager after its transport has loaded.
 *
 * @param {object} props
 * @param {string} props.addEventName
 * @param {object} props.manager
 * @param {string} [props.offlineMessage]
 * @param {string} props.placementId
 * @param {boolean} props.ready
 * @returns {import("react").ReactElement}
 */
export function DeviceManagerView({ addEventName, manager, placementId, ready, offlineMessage = "" }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [deviceToEdit, setDeviceToEdit] = useState(null);
  const [deviceToDelete, setDeviceToDelete] = useState(null);

  useEffect(() => {
    function openAddDialog(event) {
      if (event.detail === placementId) setShowAddModal(true);
    }

    window.addEventListener(addEventName, openAddDialog);
    return () => window.removeEventListener(addEventName, openAddDialog);
  }, [addEventName, placementId]);

  const rows = useMemo(
    () => manager.devices.map((device) => ({
      device,
      status: manager.deviceStatuses[device.id],
      autoConnect: manager.autoConnectIds.includes(String(device.id)),
      connecting: manager.deviceConnectingIds.includes(String(device.id)),
    })),
    [manager],
  );

  if (!ready) return <ConnectionMessage>{offlineMessage}</ConnectionMessage>;

  return (
    <>
      {showAddModal ? <DeviceFormModal manager={manager} onClose={() => setShowAddModal(false)} /> : null}
      {deviceToEdit ? <DeviceFormModal device={deviceToEdit} manager={manager} onClose={() => setDeviceToEdit(null)} /> : null}
      {deviceToDelete ? <DeleteDeviceDialog device={deviceToDelete} manager={manager} onClose={() => setDeviceToDelete(null)} /> : null}
      <DeviceTable manager={manager} onDelete={setDeviceToDelete} onEdit={setDeviceToEdit} rows={rows} />
    </>
  );
}
