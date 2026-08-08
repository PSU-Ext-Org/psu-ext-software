package com.psuext.script.execution.scpi;

/*-
 * #%L
 * PSU-BE Script Runner
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
import java.util.Objects;

import com.psuext.connection.device.DeviceConnection;
import com.psuext.connection.device.DeviceConnectionException;
import com.psuext.connection.service.ConnectionManagementService;
import com.psuext.transport.core.model.ScpiTransportResponse;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Owns script-runner SCPI sessions. A connected device has exactly one worker,
 * which keeps a SCPI query and its reply together before another script can use
 * the same transport.
 */
@Component
public final class ScriptDeviceSessionCoordinator {

    private static final Logger LOGGER = LoggerFactory.getLogger(ScriptDeviceSessionCoordinator.class);

    private final ConnectionManagementService connectionService;
    private final Object lifecycleMonitor = new Object();
    private final java.util.Map<Integer, DeviceSession> sessions = new java.util.HashMap<>();

    public ScriptDeviceSessionCoordinator(ConnectionManagementService connectionService) {
        this.connectionService = Objects.requireNonNull(connectionService, "connectionService must not be null");
    }

    /** Connects a device and creates its script SCPI worker after a successful connection. */
    public ScpiTransportResponse connect(String idOrName) {
        DeviceConnection device = resolve(idOrName);
        ScpiTransportResponse response = connectionService.connect(String.valueOf(device.id()));
        if (response.ok()) {
            synchronized (lifecycleMonitor) {
                sessions.computeIfAbsent(
                        device.id(),
                        ignored -> new DeviceSession(device, connectionService, this::invalidate));
            }
        }
        return response;
    }

    /**
     * Stops accepting new script operations, lets an already running operation
     * leave the transport, then disconnects and destroys the per-device worker.
     */
    public ScpiTransportResponse disconnect(String idOrName) {
        DeviceConnection device = resolve(idOrName);
        DeviceSession session;
        synchronized (lifecycleMonitor) {
            session = sessions.remove(device.id());
        }
        if (session == null) {
            return connectionService.disconnect(String.valueOf(device.id()));
        }
        return session.closeAndDisconnect();
    }

    /** Submits a complete SCPI request to its device-specific FIFO worker. */
    public ScpiTransportResponse send(String idOrName, String command) {
        DeviceConnection device = resolve(idOrName);
        DeviceSession session;
        synchronized (lifecycleMonitor) {
            session = sessions.get(device.id());
        }
        if (session == null || !session.accepting()) {
            throw new ScriptScpiException("DISCONNECTED", "Device is not connected for script execution: " + device.name());
        }
        return session.submit(command);
    }

    /** Resolves names and IDs to the stable persisted device identity. */
    public DeviceConnection resolve(String idOrName) {
        if (idOrName == null || idOrName.isBlank()) {
            throw new DeviceConnectionException("BAD_DEVICE_REF", "Device id or name is required");
        }
        String reference = idOrName.trim();
        List<DeviceConnection> devices = connectionService.listDevices();
        return devices.stream()
                .filter(device -> String.valueOf(device.id()).equals(reference)
                        || device.name().equalsIgnoreCase(reference))
                .findFirst()
                .orElseThrow(() -> new DeviceConnectionException("DEVICE_NOT_FOUND", "Device not found: " + reference));
    }

    @PreDestroy
    void destroy() {
        List<DeviceSession> active;
        synchronized (lifecycleMonitor) {
            active = List.copyOf(sessions.values());
            sessions.clear();
        }
        active.forEach(DeviceSession::closeAndDisconnect);
    }

    private void invalidate(DeviceSession session, String reason) {
        synchronized (lifecycleMonitor) {
            if (sessions.get(session.device().id()) == session) {
                sessions.remove(session.device().id());
            }
        }
        session.stopAccepting();
        LOGGER.warn("Script SCPI session invalidated: device={} reason={}", session.device().name(), reason);
    }
}
