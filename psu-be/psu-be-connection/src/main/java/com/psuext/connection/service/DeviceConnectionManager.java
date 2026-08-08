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

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.psuext.connection.device.DeviceConnection;
import com.psuext.connection.device.DeviceConnectionDao;
import com.psuext.connection.device.DeviceConnectionException;
import com.psuext.connection.device.DeviceConnectionType;
import com.psuext.transport.core.model.ScpiConnectionRequest;
import com.psuext.transport.core.ScpiTransport;
import com.psuext.transport.core.ScpiTransportFactory;
import com.psuext.transport.core.model.ScpiTransportResponse;
import com.psuext.transport.core.model.ScpiTransportState;
import com.psuext.transport.core.model.ScpiTransportStatus;
import org.springframework.stereotype.Service;

/**
 * Owns runtime SCPI transport sessions keyed by persisted device id.
 */
@Service
public class DeviceConnectionManager {

    private final DeviceConnectionDao deviceDao;
    private final ScpiTransportFactory transportFactory;
    private final Map<Integer, ScpiTransport> transports = new HashMap<>();
    private final Map<Integer, DeviceConnection> transportProfiles = new HashMap<>();

    /**
     * Creates the live connection manager.
     *
     * @param deviceDao persisted device registry
     * @param transportFactory transport factory
     */
    public DeviceConnectionManager(DeviceConnectionDao deviceDao, ScpiTransportFactory transportFactory) {
        this.deviceDao = deviceDao;
        this.transportFactory = transportFactory;
    }

    /**
     * Connects a configured device by id or name.
     *
     * @param idOrName configured device id or name
     * @return transport response
     */
    public synchronized ScpiTransportResponse connect(String idOrName) {
        DeviceConnection device = resolve(idOrName);
        invalidateChangedTransport(device);
        ScpiTransport transport = transports.computeIfAbsent(
                device.id(),
                id -> createTransport(device));
        return transport.connect(requestFor(device));
    }

    /**
     * Disconnects a configured device by id or name.
     *
     * @param idOrName configured device id or name
     * @return transport response
     */
    public synchronized ScpiTransportResponse disconnect(String idOrName) {
        DeviceConnection device = resolve(idOrName);
        ScpiTransport transport = transports.remove(device.id());
        transportProfiles.remove(device.id());
        if (transport == null) {
            return ScpiTransportResponse.ok("DISCONNECTED");
        }
        return transport.disconnect();
    }

    /**
     * Disconnects a device id if it currently has a live transport.
     *
     * @param id device id
     */
    public synchronized void disconnectIfConnected(int id) {
        ScpiTransport transport = transports.remove(id);
        transportProfiles.remove(id);
        if (transport != null) {
            transport.disconnect();
        }
    }

    /**
     * Returns one configured device status.
     *
     * @param idOrName configured device id or name
     * @return device status
     */
    public synchronized ManagedDeviceStatus status(String idOrName) {
        DeviceConnection device = resolve(idOrName);
        return new ManagedDeviceStatus(device, statusFor(device));
    }

    /**
     * Returns statuses for all configured devices ordered by id.
     *
     * @return device statuses
     */
    public synchronized List<ManagedDeviceStatus> statusAll() {
        return deviceDao.list().stream()
                .map(device -> new ManagedDeviceStatus(device, statusFor(device)))
                .toList();
    }

    /**
     * Sends one SCPI command to a connected device.
     *
     * @param idOrName configured device id or name
     * @param command raw SCPI command
     * @return transport response
     */
    public synchronized ScpiTransportResponse send(String idOrName, String command) {
        DeviceConnection device = resolve(idOrName);
        ScpiTransport transport = transports.get(device.id());
        if (transport == null) {
            return ScpiTransportResponse.error("DISCONNECTED", "Device is not connected: " + device.name());
        }
        return transport.send(command);
    }

    private ScpiTransportStatus statusFor(DeviceConnection device) {
        ScpiTransport transport = transports.get(device.id());
        if (transport == null) {
            return new ScpiTransportStatus(
                    ScpiTransportState.DISCONNECTED,
                    device.type().name().toLowerCase(),
                    null,
                    null);
        }
        return transport.status();
    }

    private DeviceConnection resolve(String idOrName) {
        if (idOrName == null || idOrName.isBlank()) {
            throw new DeviceConnectionException("BAD_DEVICE_REF", "Device id or name is required");
        }
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

    private void invalidateChangedTransport(DeviceConnection device) {
        DeviceConnection transportProfile = transportProfiles.get(device.id());
        if (device.equals(transportProfile)) {
            return;
        }
        ScpiTransport transport = transports.remove(device.id());
        transportProfiles.remove(device.id());
        if (transport != null) {
            transport.disconnect();
        }
    }

    private ScpiTransport createTransport(DeviceConnection device) {
        transportProfiles.put(device.id(), device);
        return transportFactory.create(device.type().name());
    }

    private ScpiConnectionRequest requestFor(DeviceConnection device) {
        if (device.type() == DeviceConnectionType.TCP) {
            return new ScpiConnectionRequest(device.ip(), Integer.parseInt(device.port()));
        }
        return ScpiConnectionRequest.usb(device.port(), device.baudrate());
    }
}


