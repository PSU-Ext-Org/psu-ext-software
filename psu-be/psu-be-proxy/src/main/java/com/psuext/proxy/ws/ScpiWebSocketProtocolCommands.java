package com.psuext.proxy.ws;

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

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import com.psuext.connection.device.DeviceConnection;
import com.psuext.connection.device.DeviceConnectionPatch;
import com.psuext.connection.device.DeviceConnectionType;
import com.psuext.proxy.scpi.ScpiBridgeResponse;
import com.psuext.proxy.scpi.ScpiBridgeService;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

/**
 * Shared helpers for concrete WebSocket protocol commands.
 */
abstract class AbstractScpiWebSocketCommand implements ScpiWebSocketCommand {

    protected final ScpiBridgeService bridgeService;

    AbstractScpiWebSocketCommand(ScpiBridgeService bridgeService) {
        this.bridgeService = bridgeService;
    }

    protected ScpiBridgeResponse text(String value) {
        return ScpiBridgeResponse.text(value);
    }

    protected DeviceConnectionType parseType(String value) {
        try {
            return DeviceConnectionType.valueOf((value == null ? "" : value.trim()).toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("BAD_DEVICE_TYPE Type must be TCP or USB");
        }
    }

    protected Integer parseOptionalBaudrate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Integer.valueOf(value.trim());
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("BAD_BAUDRATE Baudrate must be a number");
        }
    }

    protected String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    protected String bodyAfterCommand(String payload) {
        return payload.trim().substring(command().length()).trim();
    }

    protected String trimTrailingLineBreaks(String value) {
        int end = value.length();
        while (end > 0) {
            char current = value.charAt(end - 1);
            if (current != '\n' && current != '\r') {
                break;
            }
            end--;
        }
        return value.substring(0, end);
    }
}

/**
 * Handles {@code /device-add}.
 */
@Component
final class DeviceAddCommand extends AbstractScpiWebSocketCommand {

    DeviceAddCommand(ScpiBridgeService bridgeService) {
        super(bridgeService);
    }

    @Override
    public String command() {
        return "/device-add";
    }

    @Override
    public ScpiBridgeResponse action(WebSocketSession session, String payload) {
        String[] parts = bodyAfterCommand(payload).split(",", -1);
        if (parts.length != 5) {
            return text("ERR BAD_DEVICE_ADD_SYNTAX Use: /device-add name,type,ip,port,baudrate");
        }
        try {
            return text(bridgeService.addDevice(new DeviceConnection(
                    -1,
                    parts[0].trim(),
                    parseType(parts[1]),
                    blankToNull(parts[2]),
                    blankToNull(parts[3]),
                    parseOptionalBaudrate(parts[4]))));
        } catch (IllegalArgumentException ex) {
            return text("ERR " + ex.getMessage());
        }
    }
}

/**
 * Handles {@code /device-list}.
 */
@Component
final class DeviceListCommand extends AbstractScpiWebSocketCommand {

    DeviceListCommand(ScpiBridgeService bridgeService) {
        super(bridgeService);
    }

    @Override
    public String command() {
        return "/device-list";
    }

    @Override
    public ScpiBridgeResponse action(WebSocketSession session, String payload) {
        return text(bridgeService.listDevices());
    }
}

/**
 * Handles {@code /device-modify}.
 */
@Component
final class DeviceModifyCommand extends AbstractScpiWebSocketCommand {

    DeviceModifyCommand(ScpiBridgeService bridgeService) {
        super(bridgeService);
    }

    @Override
    public String command() {
        return "/device-modify";
    }

    @Override
    public ScpiBridgeResponse action(WebSocketSession session, String payload) {
        String[] parts = bodyAfterCommand(payload).split(",", -1);
        if (parts.length < 2 || parts[0].isBlank()) {
            return text("ERR BAD_DEVICE_MODIFY_SYNTAX Use: /device-modify "
                    + "idOrName,name=...,type=...,ip=...,port=...,baudrate=...");
        }
        Map<String, String> fields = new HashMap<>();
        for (int i = 1; i < parts.length; i++) {
            String part = parts[i].trim();
            int equals = part.indexOf('=');
            if (equals < 1) {
                return text("ERR BAD_DEVICE_MODIFY_SYNTAX Fields must use key=value");
            }
            fields.put(
                    part.substring(0, equals).trim().toLowerCase(Locale.ROOT),
                    part.substring(equals + 1).trim());
        }
        try {
            DeviceConnectionPatch patch = new DeviceConnectionPatch(
                    fields.get("name"),
                    fields.containsKey("type") ? parseType(fields.get("type")) : null,
                    fields.get("ip"),
                    fields.get("port"),
                    fields.containsKey("baudrate")
                            ? parseOptionalBaudrate(fields.get("baudrate"))
                            : null);
            return text(bridgeService.modifyDevice(parts[0].trim(), patch));
        } catch (IllegalArgumentException ex) {
            return text("ERR " + ex.getMessage());
        }
    }
}

/**
 * Handles {@code /device-delete}.
 */
@Component
final class DeviceDeleteCommand extends AbstractScpiWebSocketCommand {

    DeviceDeleteCommand(ScpiBridgeService bridgeService) {
        super(bridgeService);
    }

    @Override
    public String command() {
        return "/device-delete";
    }

    @Override
    public ScpiBridgeResponse action(WebSocketSession session, String payload) {
        return text(bridgeService.deleteDevice(bodyAfterCommand(payload)));
    }
}

/**
 * Handles {@code /connect}.
 */
@Component
final class ConnectCommand extends AbstractScpiWebSocketCommand {

    ConnectCommand(ScpiBridgeService bridgeService) {
        super(bridgeService);
    }

    @Override
    public String command() {
        return "/connect";
    }

    @Override
    public ScpiBridgeResponse action(WebSocketSession session, String payload) {
        String idOrName = bodyAfterCommand(payload);
        if (idOrName.isBlank()) {
            return text("ERR BAD_DEVICE_REF Device id or name is required");
        }
        String response = bridgeService.connect(idOrName);
        if (response.startsWith("OK ")) {
            session.getAttributes().put(ScpiWebSocketHandler.SESSION_DEVICE_KEY, idOrName);
        }
        return text(response);
    }
}

/**
 * Handles {@code /disconnect}.
 */
@Component
final class DisconnectCommand extends AbstractScpiWebSocketCommand {

    DisconnectCommand(ScpiBridgeService bridgeService) {
        super(bridgeService);
    }

    @Override
    public String command() {
        return "/disconnect";
    }

    @Override
    public ScpiBridgeResponse action(WebSocketSession session, String payload) {
        String idOrName = bodyAfterCommand(payload);
        if (idOrName.isBlank()) {
            return text("ERR BAD_DEVICE_REF Device id or name is required");
        }
        String response = bridgeService.disconnect(idOrName);
        if (idOrName.equals(session.getAttributes().get(ScpiWebSocketHandler.SESSION_DEVICE_KEY))) {
            session.getAttributes().remove(ScpiWebSocketHandler.SESSION_DEVICE_KEY);
        }
        return text(response);
    }
}

/**
 * Handles {@code /status}.
 */
@Component
final class StatusCommand extends AbstractScpiWebSocketCommand {

    StatusCommand(ScpiBridgeService bridgeService) {
        super(bridgeService);
    }

    @Override
    public String command() {
        return "/status";
    }

    @Override
    public ScpiBridgeResponse action(WebSocketSession session, String payload) {
        String idOrName = bodyAfterCommand(payload);
        return text(bridgeService.status(idOrName.isBlank() ? null : idOrName));
    }
}

/**
 * Handles explicit {@code CMD idOrName <SCPI content>} frames.
 */
@Component
final class ExplicitScpiCommand extends AbstractScpiWebSocketCommand {

    ExplicitScpiCommand(ScpiBridgeService bridgeService) {
        super(bridgeService);
    }

    @Override
    public String command() {
        return "CMD";
    }

    @Override
    public ScpiBridgeResponse action(WebSocketSession session, String payload) {
        String body = bodyAfterCommand(payload);
        int separator = body.indexOf(' ');
        if (separator < 1 || separator == body.length() - 1) {
            return text("ERR BAD_CMD_SYNTAX Use: CMD idOrName <SCPI content>");
        }
        return bridgeService.sendResponse(
                body.substring(0, separator).trim(),
                trimTrailingLineBreaks(body.substring(separator + 1)));
    }
}
