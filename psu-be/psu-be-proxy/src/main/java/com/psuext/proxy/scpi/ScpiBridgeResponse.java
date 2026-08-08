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

import java.util.Arrays;
import java.util.Base64;

import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketMessage;

/**
 * Browser-facing bridge response that can be emitted as a WebSocket frame.
 */
public sealed interface ScpiBridgeResponse permits ScpiBridgeResponse.Text, ScpiBridgeResponse.Binary {

    /**
     * Creates a text response.
     *
     * @param text text protocol response
     * @return text bridge response
     */
    static ScpiBridgeResponse text(String text) {
        return new Text(text);
    }

    /**
     * Creates a binary response.
     *
     * @param binary complete WebSocket binary frame payload
     * @return binary bridge response
     */
    static ScpiBridgeResponse binary(byte[] binary) {
        return new Binary(binary);
    }

    /**
     * Converts this response to a UUID-tagged WebSocket envelope.
     *
     * @param uuid request UUID to echo back to the browser
     * @return text or binary WebSocket message
     */
    WebSocketMessage<?> toWebSocketMessage(String uuid);

    /**
     * Converts this response to a text protocol response.
     *
     * @return text protocol response
     */
    String protocolText();

    /**
     * Text WebSocket bridge response.
     *
     * @param text text protocol response
     */
        record Text(String text) implements ScpiBridgeResponse {

        @Override
        public WebSocketMessage<?> toWebSocketMessage(String uuid) {
            return new TextMessage("RES " + uuid + " " + text);
        }

        @Override
        public String protocolText() {
            return text;
        }
    }

    /**
     * Binary WebSocket bridge response.
     *
     * @param binary complete binary frame payload
     */
    record Binary(byte[] binary) implements ScpiBridgeResponse {

        public Binary {
            binary = Arrays.copyOf(binary, binary.length);
        }

        @Override
        public WebSocketMessage<?> toWebSocketMessage(String uuid) {
            return new TextMessage("BIN " + uuid + " " + Base64.getEncoder().encodeToString(binary));
        }

        @Override
        public String protocolText() {
            return "ERR BINARY_RESPONSE Use the WebSocket binary response path for this command";
        }

        @Override
        public byte[] binary() {
            return Arrays.copyOf(binary, binary.length);
        }
    }
}
