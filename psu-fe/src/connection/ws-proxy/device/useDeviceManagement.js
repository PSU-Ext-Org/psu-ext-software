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
import { useRef } from "react";

/**
 * Manages persistent device profile CRUD operations over WebSocket.
 *
 * @param {object} options
 * @param {(message: string) => string | null} options.sendWsMessage
 * @param {() => void} options.onRefresh - Called after a successful add/modify/delete to reload the device list.
 * @returns {{
 *   addDevice: (fields: {name: string, type: string, ip: string, port: string, baudrate: string}) => Promise<void>,
 *   modifyDevice: (id: string, fields: {name: string, type: string, ip: string, port: string, baudrate: string}) => Promise<void>,
 *   deleteDevice: (id: string) => Promise<void>,
 *   updateDeviceManagementFromMessage: (message: string, uuid: string) => boolean,
 *   resetDeviceManagement: () => void,
 * }}
 */
export function useDeviceManagement({ sendWsMessage, onRefresh }) {
  const pendingAddByUuidRef = useRef(new Map());
  const pendingModifyByUuidRef = useRef(new Map());
  const pendingDeleteByUuidRef = useRef(new Map());

  function addDevice({ name, type, ip, port, baudrate }) {
    return new Promise((resolve, reject) => {
      const uuid = sendWsMessage(`/device-add ${name},${type},${ip},${port},${baudrate}`);
      if (!uuid) {
        reject("Cannot send device-add command");
        return;
      }
      pendingAddByUuidRef.current.set(uuid, { resolve, reject });
    });
  }

  function modifyDevice(id, { name, type, ip, port, baudrate }) {
    return new Promise((resolve, reject) => {
      const fields = [`name=${name}`, `type=${type}`, `ip=${ip || ""}`, `port=${port}`, `baudrate=${baudrate || ""}`];
      const uuid = sendWsMessage(`/device-modify ${id},${fields.join(",")}`);
      if (!uuid) {
        reject("Cannot send device-modify command");
        return;
      }
      pendingModifyByUuidRef.current.set(uuid, { resolve, reject });
    });
  }

  function deleteDevice(id) {
    return new Promise((resolve, reject) => {
      const uuid = sendWsMessage(`/device-delete ${id}`);
      if (!uuid) {
        reject("Cannot send device-delete command");
        return;
      }
      pendingDeleteByUuidRef.current.set(uuid, { resolve, reject });
    });
  }

  function updateDeviceManagementFromMessage(message, uuid) {
    const pendingAdd = pendingAddByUuidRef.current.get(uuid);
    if (pendingAdd) {
      pendingAddByUuidRef.current.delete(uuid);
      if (message.startsWith("ERR ")) {
        pendingAdd.reject(message);
      } else {
        pendingAdd.resolve();
        onRefresh();
      }
      return true;
    }

    const pendingModify = pendingModifyByUuidRef.current.get(uuid);
    if (pendingModify) {
      pendingModifyByUuidRef.current.delete(uuid);
      if (message.startsWith("ERR ")) {
        pendingModify.reject(message);
      } else {
        pendingModify.resolve();
        onRefresh();
      }
      return true;
    }

    const pendingDelete = pendingDeleteByUuidRef.current.get(uuid);
    if (pendingDelete) {
      pendingDeleteByUuidRef.current.delete(uuid);
      if (message.startsWith("ERR ")) {
        pendingDelete.reject(message);
      } else {
        pendingDelete.resolve();
        onRefresh();
      }
      return true;
    }

    return false;
  }

  function resetDeviceManagement() {
    pendingAddByUuidRef.current = new Map();
    pendingModifyByUuidRef.current = new Map();
    pendingDeleteByUuidRef.current = new Map();
  }

  return {
    addDevice,
    modifyDevice,
    deleteDevice,
    updateDeviceManagementFromMessage,
    resetDeviceManagement,
  };
}
