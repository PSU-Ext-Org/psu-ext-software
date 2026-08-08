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

import java.util.Locale;
import java.util.Map;

import com.psuext.proxy.scpi.ScpiBridgeResponse;
import com.psuext.proxy.scpi.ScpiBridgeService;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * Raw text WebSocket handler for the SCPI bridge protocol.
 *
 * <p>Reserved slash commands manage device profiles and connection lifecycle.
 * {@code CMD idOrName ...} targets an explicit device, while raw SCPI frames are
 * sent to the session default set by {@code /connect idOrName}.
 */
@Component
public class ScpiWebSocketHandler extends TextWebSocketHandler {

    static final String SESSION_DEVICE_KEY = "psu.defaultDevice";

    private final ScpiBridgeService bridgeService;
    private final Map<String, ScpiWebSocketCommand> commands;

    /**
     * Creates the WebSocket handler.
     *
     * @param bridgeService device-aware SCPI bridge service
     * @param commands protocol command dispatch map
     */
    public ScpiWebSocketHandler(
            ScpiBridgeService bridgeService,
            @Qualifier("scpiWebSocketCommandMap") Map<String, ScpiWebSocketCommand> commands) {
        this.bridgeService = bridgeService;
        this.commands = Map.copyOf(commands);
    }

    /**
     * Handles one inbound WebSocket text frame and replies only to the sending
     * session.
     *
     * @param session sender WebSocket session
     * @param message inbound text message
     * @throws Exception when the WebSocket session cannot send the reply
     */
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        session.sendMessage(handle(session, message.getPayload()));
    }

    private WebSocketMessage<?> handle(WebSocketSession session, String payload) {
        ParsedRequest request = parseRequest(payload);
        if (request.errorResponse() != null) {
            return request.errorResponse();
        }

        String trimmed = request.payload().trim();
        ScpiWebSocketCommand command = commands.get(commandKey(trimmed));
        if (command != null) {
            return command.action(session, request.payload()).toWebSocketMessage(request.uuid());
        }

        Object defaultDevice = session.getAttributes().get(SESSION_DEVICE_KEY);
        if (defaultDevice == null || String.valueOf(defaultDevice).isBlank()) {
            return ScpiBridgeResponse.text(
                    "ERR NO_SESSION_DEVICE Use /connect <idOrName> or CMD <idOrName> <SCPI>")
                    .toWebSocketMessage(request.uuid());
        }
        return bridgeService.sendResponse(
                String.valueOf(defaultDevice),
                trimTrailingLineBreaks(request.payload())).toWebSocketMessage(request.uuid());
    }

    private String commandKey(String payload) {
        int separator = payload.indexOf(' ');
        String key = separator < 0 ? payload : payload.substring(0, separator);
        return key.toLowerCase(Locale.ROOT);
    }

    private static TextMessage text(String value) {
        return new TextMessage(value);
    }

    private ParsedRequest parseRequest(String payload) {
        String trimmed = payload == null ? "" : payload.trim();
        if (trimmed.isEmpty()) {
            return ParsedRequest.error(text("ERR EMPTY_MESSAGE Use: REQ <uuid> <payload>"));
        }
        if (!trimmed.startsWith("REQ")) {
            return ParsedRequest.error(text("ERR BAD_REQUEST_ENVELOPE Use: REQ <uuid> <payload>"));
        }

        int firstSeparator = trimmed.indexOf(' ');
        if (firstSeparator < 0) {
            return ParsedRequest.error(text("ERR BAD_REQUEST_ENVELOPE Use: REQ <uuid> <payload>"));
        }

        String remainder = trimmed.substring(firstSeparator + 1).trim();
        if (remainder.isEmpty()) {
            return ParsedRequest.error(text("ERR BAD_REQUEST_ENVELOPE Use: REQ <uuid> <payload>"));
        }

        int secondSeparator = remainder.indexOf(' ');
        if (secondSeparator < 0) {
            String uuidOnly = remainder.trim();
            return ParsedRequest.error(ScpiBridgeResponse.text("ERR EMPTY_MESSAGE Use: REQ <uuid> <payload>")
                    .toWebSocketMessage(uuidOnly));
        }

        String uuid = remainder.substring(0, secondSeparator).trim();
        String requestPayload = remainder.substring(secondSeparator + 1);
        if (uuid.isBlank()) {
            return ParsedRequest.error(text("ERR BAD_REQUEST_ENVELOPE Use: REQ <uuid> <payload>"));
        }
        if (requestPayload.trim().isEmpty()) {
            return ParsedRequest.error(ScpiBridgeResponse.text("ERR EMPTY_MESSAGE Use: REQ <uuid> <payload>")
                    .toWebSocketMessage(uuid));
        }
        return ParsedRequest.success(uuid, requestPayload);
    }

    private static String trimTrailingLineBreaks(String value) {
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

    /**
     * Parsed UUID-tagged browser request.
     *
     * @param uuid request UUID
     * @param payload inner command payload
     * @param errorResponse fallback protocol error when the request is malformed
     */
    private record ParsedRequest(String uuid, String payload, WebSocketMessage<?> errorResponse) {

        static ParsedRequest success(String uuid, String payload) {
            return new ParsedRequest(uuid, payload, null);
        }

        static ParsedRequest error(WebSocketMessage<?> errorResponse) {
            return new ParsedRequest("", "", errorResponse);
        }
    }
}
