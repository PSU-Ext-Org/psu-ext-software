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

import com.psuext.proxy.scpi.ScpiBridgeResponse;
import org.springframework.web.socket.WebSocketSession;

/**
 * One browser-facing WebSocket protocol command.
 */
public interface ScpiWebSocketCommand {

    /**
     * Returns the command key used for dispatch.
     *
     * @return first-token command key, such as {@code /connect} or {@code CMD}
     */
    String command();

    /**
     * Executes one inbound WebSocket command.
     *
     * @param session sender WebSocket session
     * @param payload complete inbound payload
     * @return payload-level bridge response
     */
    ScpiBridgeResponse action(WebSocketSession session, String payload);
}
