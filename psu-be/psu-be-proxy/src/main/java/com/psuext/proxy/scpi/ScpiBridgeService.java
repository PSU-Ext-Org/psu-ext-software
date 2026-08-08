package com.psuext.proxy.scpi;

/*-
 * #%L
 * PSU-BE Proxy
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

import com.psuext.connection.device.DeviceConnection;
import com.psuext.connection.device.DeviceConnectionException;
import com.psuext.connection.device.DeviceConnectionPatch;
import com.psuext.connection.service.ConnectionManagementService;
import com.psuext.connection.service.ManagedDeviceStatus;
import com.psuext.transport.core.model.ScpiTransportResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Device-aware facade used by browser-facing endpoints.
 *
 * <p>The service formats device registry and transport responses into the
 * plain-text WebSocket protocol.
 */
@Service
public class ScpiBridgeService {

    private static final Logger LOGGER = LoggerFactory.getLogger(ScpiBridgeService.class);
    private final ConnectionManagementService connectionService;

    /**
     * Creates a bridge service around the configured device registry and live
     * connection manager.
     *
     * @param connectionService shared connection management service
     */
    public ScpiBridgeService(ConnectionManagementService connectionService) {
        this.connectionService = connectionService;
    }

    /**
     * Adds a device profile.
     *
     * @param device profile to add
     * @return protocol response
     */
    public String addDevice(DeviceConnection device) {
        try {
            return "OK DEVICE_ADDED " + formatDevice(connectionService.addDevice(device));
        } catch (DeviceConnectionException ex) {
            return format(ex);
        }
    }

    /**
     * Lists configured devices as comma-separated rows.
     *
     * @return newline-separated device rows or {@code OK NO_DEVICES}
     */
    public String listDevices() {
        try {
            List<DeviceConnection> devices = connectionService.listDevices();
            if (devices.isEmpty()) {
                return "OK NO_DEVICES";
            }
            return devices.stream()
                    .map(this::formatDevice)
                    .reduce((left, right) -> left + "\n" + right)
                    .orElse("OK NO_DEVICES");
        } catch (DeviceConnectionException ex) {
            return format(ex);
        }
    }

    /**
     * Modifies a device profile.
     *
     * @param idOrName target id or name
     * @param patch partial update
     * @return protocol response
     */
    public String modifyDevice(String idOrName, DeviceConnectionPatch patch) {
        try {
            return "OK DEVICE_MODIFIED " + formatDevice(connectionService.modifyDevice(idOrName, patch));
        } catch (DeviceConnectionException ex) {
            return format(ex);
        }
    }

    /**
     * Disconnects and deletes a device profile.
     *
     * @param idOrName target id or name
     * @return protocol response
     */
    public String deleteDevice(String idOrName) {
        try {
            return "OK DEVICE_DELETED " + formatDevice(connectionService.deleteDevice(idOrName));
        } catch (DeviceConnectionException ex) {
            return format(ex);
        }
    }

    /**
     * Connects one configured device.
     *
     * @param idOrName target id or name
     * @return protocol response
     */
    public String connect(String idOrName) {
        try {
            return format(connectionService.connect(idOrName));
        } catch (DeviceConnectionException ex) {
            return format(ex);
        }
    }

    /**
     * Disconnects one configured device.
     *
     * @param idOrName target id or name
     * @return protocol response
     */
    public String disconnect(String idOrName) {
        try {
            return format(connectionService.disconnect(idOrName));
        } catch (DeviceConnectionException ex) {
            return format(ex);
        }
    }

    /**
     * Returns one or all device statuses.
     *
     * @param idOrName optional target id or name
     * @return status response
     */
    public String status(String idOrName) {
        try {
            if (idOrName == null || idOrName.isBlank()) {
                List<ManagedDeviceStatus> statuses = connectionService.statusAll();
                if (statuses.isEmpty()) {
                    return "OK NO_DEVICES";
                }
                return statuses.stream()
                        .map(this::formatStatus)
                        .reduce((left, right) -> left + "\n" + right)
                        .orElse("OK NO_DEVICES");
            }
            return formatStatus(connectionService.status(idOrName));
        } catch (DeviceConnectionException ex) {
            return format(ex);
        }
    }

    /**
     * Sends one SCPI command to a target device.
     *
     * @param idOrName target id or name
     * @param command raw SCPI command without transport line ending
     * @return raw SCPI text reply, or protocol control/error response
     */
    public String send(String idOrName, String command) {
        return sendResponse(idOrName, command).protocolText();
    }

    /**
     * Sends one SCPI command to a target device and preserves binary replies.
     *
     * @param idOrName target id or name
     * @param command raw SCPI command without transport line ending
     * @return text protocol response or binary SCPI block
     */
    public ScpiBridgeResponse sendResponse(String idOrName, String command) {
        try {
            LOGGER.debug("Bridge send: target={} command={}", idOrName, sanitize(command));
            ScpiBridgeResponse response = formatResponse(connectionService.send(idOrName, command));
            logResponse(idOrName, response);
            return response;
        } catch (DeviceConnectionException ex) {
            LOGGER.debug("Bridge send failed: target={} error={}", idOrName, sanitize(ex.getMessage()));
            return ScpiBridgeResponse.text(format(ex));
        }
    }

    private String format(ScpiTransportResponse response) {
        return formatResponse(response).protocolText();
    }

    private ScpiBridgeResponse formatResponse(ScpiTransportResponse response) {
        if (response instanceof ScpiTransportResponse.Control control) {
            return ScpiBridgeResponse.text("OK " + control.message());
        }
        if (response instanceof ScpiTransportResponse.Text text) {
            return ScpiBridgeResponse.text(text.rawResponse());
        }
        if (response instanceof ScpiTransportResponse.Binary binary) {
            return ScpiBridgeResponse.binary(binary.binaryResponse());
        }
        ScpiTransportResponse.Error error = (ScpiTransportResponse.Error) response;
        return ScpiBridgeResponse.text("ERR " + error.code() + " " + error.message());
    }

    private String format(DeviceConnectionException ex) {
        return "ERR " + ex.code() + " " + ex.getMessage();
    }

    private String formatDevice(DeviceConnection device) {
        return device.id()
                + "," + emptyIfNull(device.name())
                + "," + device.type()
                + "," + emptyIfNull(device.ip())
                + "," + emptyIfNull(device.port())
                + "," + (device.baudrate() == null ? "" : device.baudrate());
    }

    private String emptyIfNull(String value) {
        return value == null ? "" : value;
    }

    private void logResponse(String idOrName, ScpiBridgeResponse response) {
        if (response instanceof ScpiBridgeResponse.Text text) {
            LOGGER.debug("Bridge response text: target={} payload={}", idOrName, sanitize(text.protocolText()));
            return;
        }
        ScpiBridgeResponse.Binary binary = (ScpiBridgeResponse.Binary) response;
        LOGGER.debug("Bridge response binary: target={} bytes={}", idOrName, binary.binary().length);
    }

    private String sanitize(String value) {
        if (value == null) {
            return "";
        }
        return value.replace('\n', ' ').replace('\r', ' ');
    }

    private String formatStatus(ManagedDeviceStatus status) {
        StringBuilder builder = new StringBuilder("STATUS id=")
                .append(status.device().id())
                .append(" name=")
                .append(status.device().name())
                .append(" state=")
                .append(status.transportStatus().state())
                .append(" transport=")
                .append(status.device().type().name().toLowerCase());
        if (status.device().type().name().equals("USB")) {
            if (status.device().port() != null && !status.device().port().isBlank()) {
                builder.append(" port=").append(status.device().port());
            }
            if (status.device().baudrate() != null) {
                builder.append(" baudrate=").append(status.device().baudrate());
            }
        } else if (status.transportStatus().target() != null) {
            builder.append(" host=").append(status.transportStatus().target().host())
                    .append(" port=").append(status.transportStatus().target().port());
        }
        if (status.transportStatus().lastError() != null && !status.transportStatus().lastError().isBlank()) {
            builder.append(" lastError=").append(status.transportStatus().lastError());
        }
        return builder.toString();
    }
}
