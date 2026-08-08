package com.psuext.connection.service;

/*-
 * #%L
 * PSU-BE Connection
 * %%
 * Copyright (C) 2026 The PSU-EXT Authors
 * %%
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *      http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * #L%
 */

import java.util.List;

import com.psuext.connection.data.TypedScpiDataParser;
import com.psuext.connection.data.TypedScpiQueryResult;
import com.psuext.connection.device.DeviceConnection;
import com.psuext.connection.device.DeviceConnectionDao;
import com.psuext.connection.device.DeviceConnectionException;
import com.psuext.connection.device.DeviceConnectionPatch;
import com.psuext.transport.core.model.ScpiTransportResponse;
import org.springframework.stereotype.Service;

/**
 * Shared facade for configured device CRUD, connection lifecycle, raw SCPI
 * execution, and typed DATA queries.
 */
@Service
public class ConnectionManagementService {

    private final DeviceConnectionDao deviceDao;
    private final DeviceConnectionManager connectionManager;
    private final List<TypedScpiDataParser> typedDataParsers;

    /**
     * Creates the shared connection management facade.
     *
     * @param deviceDao persisted device registry
     * @param connectionManager runtime connection manager
     * @param typedDataParsers typed DATA parsers
     */
    public ConnectionManagementService(
            DeviceConnectionDao deviceDao,
            DeviceConnectionManager connectionManager,
            List<TypedScpiDataParser> typedDataParsers) {
        this.deviceDao = deviceDao;
        this.connectionManager = connectionManager;
        this.typedDataParsers = List.copyOf(typedDataParsers);
    }

    /**
     * Adds a device profile.
     *
     * @param device device profile to add
     * @return stored device profile
     */
    public DeviceConnection addDevice(DeviceConnection device) {
        return deviceDao.add(device);
    }

    /**
     * Lists all configured device profiles.
     *
     * @return configured device profiles ordered by id
     */
    public List<DeviceConnection> listDevices() {
        return deviceDao.list();
    }

    /**
     * Modifies one configured device profile and disconnects its live transport.
     *
     * @param idOrName target device id or name
     * @param patch replacement fields
     * @return updated device profile
     */
    public DeviceConnection modifyDevice(String idOrName, DeviceConnectionPatch patch) {
        DeviceConnection existing = resolve(idOrName);
        DeviceConnection modified = deviceDao.modify(idOrName, patch);
        connectionManager.disconnectIfConnected(existing.id());
        return modified;
    }

    /**
     * Disconnects and deletes one configured device profile.
     *
     * @param idOrName target device id or name
     * @return deleted device profile
     */
    public DeviceConnection deleteDevice(String idOrName) {
        DeviceConnection device = resolve(idOrName);
        connectionManager.disconnectIfConnected(device.id());
        return deviceDao.delete(idOrName);
    }

    /**
     * Connects one configured device.
     *
     * @param idOrName target device id or name
     * @return transport response
     */
    public ScpiTransportResponse connect(String idOrName) {
        return connectionManager.connect(idOrName);
    }

    /**
     * Disconnects one configured device.
     *
     * @param idOrName target device id or name
     * @return transport response
     */
    public ScpiTransportResponse disconnect(String idOrName) {
        return connectionManager.disconnect(idOrName);
    }

    /**
     * Returns one configured device status.
     *
     * @param idOrName target device id or name
     * @return device status
     */
    public ManagedDeviceStatus status(String idOrName) {
        return connectionManager.status(idOrName);
    }

    /**
     * Returns statuses for all configured devices.
     *
     * @return device statuses ordered by configured device id
     */
    public List<ManagedDeviceStatus> statusAll() {
        return connectionManager.statusAll();
    }

    /**
     * Sends one raw SCPI command to a connected device.
     *
     * @param idOrName target device id or name
     * @param command raw SCPI command
     * @return transport response
     */
    public ScpiTransportResponse send(String idOrName, String command) {
        return connectionManager.send(idOrName, command);
    }

    /**
     * Sends one typed DATA query to a connected device.
     *
     * @param idOrName target device id or name
     * @param command raw SCPI DATA command
     * @return parsed DATA query result
     */
    public TypedScpiQueryResult queryTypedData(String idOrName, String command) {
        ScpiTransportResponse response = send(idOrName, command);
        if (response instanceof ScpiTransportResponse.Error error) {
            return TypedScpiQueryResult.error(error.code(), error.message());
        }
        if (!(response instanceof ScpiTransportResponse.Binary binary)) {
            return TypedScpiQueryResult.error("UNSUPPORTED_DATA_RESPONSE", "Typed DATA queries require a binary reply");
        }
        TypedScpiDataParser parser = typedDataParsers.stream()
                .filter(candidate -> candidate.supports(command))
                .findFirst()
                .orElseThrow(() -> new DeviceConnectionException(
                        "UNSUPPORTED_DATA_COMMAND",
                        "No typed DATA parser is available for command: " + command));
        return TypedScpiQueryResult.success(parser.parse(command, binary.binaryResponse()));
    }

    private DeviceConnection resolve(String idOrName) {
        try {
            int id = Integer.parseInt(idOrName.trim());
            return deviceDao.findOneById(id)
                    .orElseThrow(() -> notFound(idOrName));
        } catch (NumberFormatException ex) {
            return deviceDao.findOneByName(idOrName.trim())
                    .orElseThrow(() -> notFound(idOrName));
        }
    }

    private DeviceConnectionException notFound(String idOrName) {
        return new DeviceConnectionException("DEVICE_NOT_FOUND", "Device not found: " + idOrName);
    }
}


