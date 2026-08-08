package com.psuext.transport.core;

/*-
 * #%L
 * PSU-BE Transport
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

import com.psuext.transport.core.model.ScpiConnectionRequest;
import com.psuext.transport.core.model.ScpiTransportResponse;
import com.psuext.transport.core.model.ScpiTransportStatus;

/**
 * Transport-neutral contract for sending SCPI commands to a PSU-EXT endpoint.
 *
 * <p>Implementations may use TCP, USB, a fake test transport, or another
 * backend. The WebSocket layer must depend on this abstraction rather than a
 * concrete transport.
 */
public interface ScpiTransport {

    /**
     * Opens or reconfigures the transport connection.
     *
     * @param request optional transport-specific connection target
     * @return successful connection response or structured error
     */
    ScpiTransportResponse connect(ScpiConnectionRequest request);

    /**
     * Closes the active transport connection if one exists.
     *
     * @return successful disconnect response or structured error
     */
    ScpiTransportResponse disconnect();

    /**
     * Reports the current transport state and active target.
     *
     * @return current transport status
     */
    ScpiTransportStatus status();

    /**
     * Sends one raw SCPI command over the active transport.
     *
     * @param command command text without transport framing
     * @return raw SCPI text reply, raw SCPI binary block, successful command
     * acknowledgement, or structured error
     */
    ScpiTransportResponse send(String command);
}


