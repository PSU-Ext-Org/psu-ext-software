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

import java.util.Objects;

import com.psuext.connection.device.DeviceConnectionException;
import com.psuext.transport.core.model.ScpiTransportResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Script SCPI gateway backed by the shared connection management service.
 */
public final class ConnectionManagementScriptScpiGateway implements ScriptScpiGateway {

    private static final int MAXIMUM_LOGGED_COMMAND_LENGTH = 512;
    private static final Logger LOGGER = LoggerFactory.getLogger(ConnectionManagementScriptScpiGateway.class);
    private final ScriptDeviceSessionCoordinator sessionCoordinator;

    /**
     * Creates a script SCPI gateway.
     *
     * @param connectionService shared connection management facade
     */
    public ConnectionManagementScriptScpiGateway(ScriptDeviceSessionCoordinator sessionCoordinator) {
        this.sessionCoordinator = Objects.requireNonNull(sessionCoordinator, "sessionCoordinator must not be null");
    }

    @Override
    public void write(String idOrName, String command) {
        validate("write", idOrName, command, ScriptScpiCommandValidator::requireWrite);
        ScpiTransportResponse response = sendValidated("write", idOrName, command);
        if (response instanceof ScpiTransportResponse.Control) {
            LOGGER.debug("Script SCPI response: action=write device={} responseType=control", idOrName.trim());
            return;
        }
        if (response instanceof ScpiTransportResponse.Error error) {
            logTransportError("write", idOrName, error.code());
            throw new ScriptScpiException(error.code(), error.message());
        }
        if (response instanceof ScpiTransportResponse.Binary) {
            LOGGER.warn("Script SCPI response rejected: action=write device={} errorCode={}",
                    idOrName.trim(), "UNSUPPORTED_BINARY_RESPONSE");
            throw new ScriptScpiException("UNSUPPORTED_BINARY_RESPONSE", "Write command returned a binary response");
        }
        ScpiTransportResponse.Text text = (ScpiTransportResponse.Text) response;
        LOGGER.warn("Script SCPI response rejected: action=write device={} errorCode={}",
                idOrName.trim(), "UNEXPECTED_TEXT_RESPONSE");
        throw new ScriptScpiException("UNEXPECTED_TEXT_RESPONSE", "Write command returned text response: "
                + text.rawResponse());
    }

    @Override
    public String queryText(String idOrName, String command) {
        validate("queryText", idOrName, command, ScriptScpiCommandValidator::requireQuery);
        ScpiTransportResponse response = sendValidated("queryText", idOrName, command);
        if (response instanceof ScpiTransportResponse.Text text) {
            LOGGER.debug("Script SCPI response: action=queryText device={} characterCount={}",
                    idOrName.trim(), text.rawResponse().length());
            return text.rawResponse();
        }
        if (response instanceof ScpiTransportResponse.Error error) {
            logTransportError("queryText", idOrName, error.code());
            throw new ScriptScpiException(error.code(), error.message());
        }
        if (response instanceof ScpiTransportResponse.Binary) {
            LOGGER.warn("Script SCPI response rejected: action=queryText device={} errorCode={}",
                    idOrName.trim(), "UNSUPPORTED_BINARY_RESPONSE");
            throw new ScriptScpiException(
                    "UNSUPPORTED_BINARY_RESPONSE",
                    "Binary query responses are not supported yet");
        }
        ScpiTransportResponse.Control control = (ScpiTransportResponse.Control) response;
        LOGGER.warn("Script SCPI response rejected: action=queryText device={} errorCode={}",
                idOrName.trim(), "NO_TEXT_RESPONSE");
        throw new ScriptScpiException("NO_TEXT_RESPONSE", "Query command returned control response: "
                + control.message());
    }

    @Override
    public byte[] queryBinary(String idOrName, String command) {
        validate("queryBinary", idOrName, command, ScriptScpiCommandValidator::requireQuery);
        ScpiTransportResponse response = sendValidated("queryBinary", idOrName, command);
        if (response instanceof ScpiTransportResponse.Binary binary) {
            LOGGER.debug("Script SCPI response: action=queryBinary device={} byteCount={}",
                    idOrName.trim(), binary.binaryResponse().length);
            return binary.binaryResponse();
        }
        if (response instanceof ScpiTransportResponse.Error error) {
            logTransportError("queryBinary", idOrName, error.code());
            throw new ScriptScpiException(error.code(), error.message());
        }
        if (response instanceof ScpiTransportResponse.Text) {
            LOGGER.warn("Script SCPI response rejected: action=queryBinary device={} errorCode={}",
                    idOrName.trim(), "UNEXPECTED_TEXT_RESPONSE");
            throw new ScriptScpiException("UNEXPECTED_TEXT_RESPONSE", "Binary query returned a text response");
        }
        ScpiTransportResponse.Control control = (ScpiTransportResponse.Control) response;
        LOGGER.warn("Script SCPI response rejected: action=queryBinary device={} errorCode={}",
                idOrName.trim(), "NO_BINARY_RESPONSE");
        throw new ScriptScpiException("NO_BINARY_RESPONSE", "Query command returned control response: "
                + control.message());
    }

    @Override
    public ScpiTransportResponse send(String idOrName, String command) {
        validate("send", idOrName, command, ScriptScpiCommandValidator::validateCommon);
        return sendValidated("send", idOrName, command);
    }

    private ScpiTransportResponse sendValidated(String action, String idOrName, String command) {
        LOGGER.debug("Script SCPI request: action={} device={} command={}",
                action, idOrName.trim(), sanitizeCommand(command));
        try {
            return sessionCoordinator.send(idOrName.trim(), command);
        } catch (ScriptScpiException exception) {
            LOGGER.warn("Script SCPI request failed: action={} device={} errorCode={}",
                    action, displayDevice(idOrName), exception.code());
            throw exception;
        } catch (DeviceConnectionException exception) {
            throw connectionFailure(action, idOrName, exception.code(), exception.getMessage());
        } catch (RuntimeException exception) {
            throw connectionFailure(action, idOrName, "CONNECTION_ERROR", exception.getMessage());
        }
    }

    private static ScriptScpiException connectionFailure(
            String action,
            String idOrName,
            String errorCode,
            String message) {
        LOGGER.warn("Script SCPI request failed: action={} device={} errorCode={}",
                action, displayDevice(idOrName), errorCode);
        return new ScriptScpiException(errorCode, message);
    }

    private static void validate(
            String action,
            String idOrName,
            String command,
            java.util.function.Consumer<String> commandValidator) {
        try {
            validateDeviceReference(idOrName);
            commandValidator.accept(command);
        } catch (ScriptScpiException exception) {
            LOGGER.warn("Script SCPI request rejected: action={} device={} errorCode={}",
                    action, displayDevice(idOrName), exception.code());
            throw exception;
        }
    }

    private static void logTransportError(String action, String idOrName, String errorCode) {
        LOGGER.warn("Script SCPI transport error: action={} device={} errorCode={}",
                action, displayDevice(idOrName), errorCode);
    }

    private static String sanitizeCommand(String command) {
        String normalized = command.replace('\r', ' ').replace('\n', ' ').trim().replaceAll("\\s+", " ");
        return normalized.length() <= MAXIMUM_LOGGED_COMMAND_LENGTH
                ? normalized
                : normalized.substring(0, MAXIMUM_LOGGED_COMMAND_LENGTH) + "...";
    }

    private static String displayDevice(String idOrName) {
        return idOrName == null ? null : idOrName.trim();
    }

    @Override
    public boolean deviceExists(String idOrName) {
        if (idOrName == null || idOrName.isBlank()) {
            LOGGER.debug("Script SCPI device lookup: device=null exists=false");
            return false;
        }
        String trimmed = idOrName.trim();
        boolean exists;
        try {
            exists = sessionCoordinator.resolve(trimmed) != null;
        } catch (DeviceConnectionException exception) {
            exists = false;
        }
        LOGGER.debug("Script SCPI device lookup: device={} exists={}", trimmed, exists);
        return exists;
    }

    private static void validateDeviceReference(String idOrName) {
        if (idOrName == null || idOrName.isBlank()) {
            throw new ScriptScpiException("INVALID_DEVICE", "Device id or name must not be blank");
        }
    }
}
