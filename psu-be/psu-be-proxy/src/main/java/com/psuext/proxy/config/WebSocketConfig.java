package com.psuext.proxy.config;

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

import com.psuext.proxy.ws.ScpiWebSocketHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * Registers raw WebSocket handlers exposed by the proxy service.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final ScpiWebSocketHandler scpiWebSocketHandler;
    private final String allowedOrigin;

    public WebSocketConfig(
            ScpiWebSocketHandler scpiWebSocketHandler,
            @Value("${psu.web.cors.allowed-origin:*}") String allowedOrigin) {
        this.scpiWebSocketHandler = scpiWebSocketHandler;
        this.allowedOrigin = allowedOrigin;
    }

    /**
     * Registers the raw SCPI WebSocket endpoint.
     *
     * @param registry Spring WebSocket handler registry
     */
    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(scpiWebSocketHandler, "/ws/scpi")
                .setAllowedOrigins(allowedOrigin);
    }
}
