package com.psuext.script.web.device.controller;

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

import com.psuext.connection.device.DeviceConnectionException;
import com.psuext.connection.service.ConnectionManagementService;
import com.psuext.script.execution.scpi.ScriptDeviceSessionCoordinator;
import com.psuext.connection.service.ManagedDeviceStatus;
import com.psuext.script.web.device.model.DeviceOperationResponse;
import com.psuext.script.web.device.model.DeviceProfileRequest;
import com.psuext.script.web.device.model.DeviceStatusResponse;
import com.psuext.script.web.device.model.DeviceTransportStatusResponse;
import com.psuext.transport.core.model.ScpiTransportResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Device manager HTTP API for the dedicated script-runner application.
 */
@RestController
@RequestMapping("/api/devices")
@Tag(name = "Device manager", description = "Configured device profiles and connection lifecycle")
public final class DeviceManagerController {

    private static final Logger LOGGER = LoggerFactory.getLogger(DeviceManagerController.class);
    private final ConnectionManagementService connectionService;
    private final ScriptDeviceSessionCoordinator sessionCoordinator;

    /**
     * Creates the device manager controller.
     *
     * @param connectionService shared connection and transport facade
     */
    public DeviceManagerController(
            ConnectionManagementService connectionService,
            ScriptDeviceSessionCoordinator sessionCoordinator) {
        this.connectionService = connectionService;
        this.sessionCoordinator = sessionCoordinator;
    }

    /**
     * Lists configured devices and current transport states.
     *
     * @return configured devices
     */
    @GetMapping
    @Operation(summary = "List configured devices")
    @ApiResponse(responseCode = "200", description = "Configured devices")
    public List<DeviceStatusResponse> list() {
        LOGGER.info("Device list requested");
        List<DeviceStatusResponse> devices = connectionService.statusAll().stream()
                .map(DeviceManagerController::toResponse)
                .toList();
        LOGGER.debug("Device list returned: count={}", devices.size());
        return devices;
    }

    /**
     * Connects one configured device using its persisted transport profile.
     *
     * @param idOrName device id or name
     * @return connection result
     */
    @PostMapping("/{idOrName}/connect")
    @Operation(summary = "Connect a configured device")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Connection succeeded"),
            @ApiResponse(responseCode = "404", description = "Device was not found"),
            @ApiResponse(responseCode = "502", description = "Transport connection failed")
    })
    public ResponseEntity<DeviceOperationResponse> connect(
            @PathVariable("idOrName") String idOrName) {
        return operation("connect", idOrName, sessionCoordinator::connect);
    }

    /**
     * Disconnects one configured device.
     *
     * @param idOrName device id or name
     * @return disconnection result
     */
    @PostMapping("/{idOrName}/disconnect")
    @Operation(summary = "Disconnect a configured device")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Disconnection succeeded"),
            @ApiResponse(responseCode = "404", description = "Device was not found"),
            @ApiResponse(responseCode = "502", description = "Transport disconnection failed")
    })
    public ResponseEntity<DeviceOperationResponse> disconnect(
            @PathVariable("idOrName") String idOrName) {
        return operation("disconnect", idOrName, sessionCoordinator::disconnect);
    }

    /**
     * Reserved device creation endpoint.
     *
     * @param request future device profile shape
     * @return unsupported response
     */
    @PostMapping
    @Operation(summary = "Add a device profile")
    @ApiResponse(responseCode = "501", description = "Device creation is not supported yet")
    public ResponseEntity<DeviceOperationResponse> add(
            @RequestBody @SuppressWarnings("unused") DeviceProfileRequest request) {
        return unsupported("add", null);
    }

    /**
     * Reserved device modification endpoint.
     *
     * @param idOrName device id or name
     * @param request future device profile shape
     * @return unsupported response
     */
    @PutMapping("/{idOrName}")
    @Operation(summary = "Modify a device profile")
    @ApiResponse(responseCode = "501", description = "Device modification is not supported yet")
    public ResponseEntity<DeviceOperationResponse> modify(
            @PathVariable("idOrName") String idOrName,
            @RequestBody @SuppressWarnings("unused") DeviceProfileRequest request) {
        return unsupported("modify", idOrName);
    }

    /**
     * Reserved device deletion endpoint.
     *
     * @param idOrName device id or name
     * @return unsupported response
     */
    @DeleteMapping("/{idOrName}")
    @Operation(summary = "Delete a device profile")
    @ApiResponse(responseCode = "501", description = "Device deletion is not supported yet")
    public ResponseEntity<DeviceOperationResponse> delete(
            @PathVariable("idOrName") String idOrName) {
        return unsupported("delete", idOrName);
    }

    private ResponseEntity<DeviceOperationResponse> operation(
            String operation,
            String idOrName,
            DeviceOperation deviceOperation
    ) {
        LOGGER.info("Device operation requested: operation={} device={}", operation, idOrName);
        try {
            ScpiTransportResponse response = deviceOperation.execute(idOrName);
            DeviceOperationResponse body = new DeviceOperationResponse(
                    operation, response.code(), response.message());

            if (response.ok()) {
                return completed(operation, idOrName, body, HttpStatus.OK);
            }

            HttpStatus status = "DEVICE_NOT_FOUND".equals(response.code())
                    ? HttpStatus.NOT_FOUND
                    : HttpStatus.BAD_GATEWAY;
            return completed(operation, idOrName, body, status);

        } catch (DeviceConnectionException exception) {
            DeviceOperationResponse body = new DeviceOperationResponse(
                    operation, exception.code(), exception.getMessage());

            HttpStatus status = "DEVICE_NOT_FOUND".equals(exception.code())
                    ? HttpStatus.NOT_FOUND
                    : HttpStatus.BAD_REQUEST;

            return completed(operation, idOrName, body, status);
        }
    }

    private static ResponseEntity<DeviceOperationResponse> completed(
            String operation,
            String idOrName,
            DeviceOperationResponse body,
            HttpStatus status) {
        LOGGER.info("Device operation completed: operation={} device={} code={} httpStatus={}",
                operation, idOrName, body.code(), status.value());
        return ResponseEntity.status(status).body(body);
    }

    private static ResponseEntity<DeviceOperationResponse> unsupported(String operation, String idOrName) {
        LOGGER.info("Device operation not supported: operation={} device={}", operation, idOrName);
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED)
                .body(DeviceOperationResponse.unsupported(operation));
    }

    private static DeviceStatusResponse toResponse(ManagedDeviceStatus status) {
        return new DeviceStatusResponse(
                status.device(),
                new DeviceTransportStatusResponse(
                        status.transportStatus().state(),
                        status.transportStatus().lastError()));
    }

    @FunctionalInterface
    private interface DeviceOperation {
        ScpiTransportResponse execute(String idOrName);
    }
}
