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
import com.psuext.transport.core.model.ScpiTransportState;
import com.psuext.transport.core.model.ScpiTransportStatus;

/**
 * Placeholder transport for configured device types that are not implemented.
 */
public class UnsupportedScpiTransport implements ScpiTransport {

    private final String message;

    /**
     * Creates an unsupported transport placeholder.
     *
     * @param message unsupported-operation detail
     */
    public UnsupportedScpiTransport(String message) {
        this.message = message;
    }

    @Override
    public ScpiTransportResponse connect(ScpiConnectionRequest request) {
        return ScpiTransportResponse.error("UNSUPPORTED_TRANSPORT", message);
    }

    @Override
    public ScpiTransportResponse disconnect() {
        return ScpiTransportResponse.ok("DISCONNECTED");
    }

    @Override
    public ScpiTransportStatus status() {
        return new ScpiTransportStatus(ScpiTransportState.DISCONNECTED, "unsupported", null, message);
    }

    @Override
    public ScpiTransportResponse send(String command) {
        return ScpiTransportResponse.error("UNSUPPORTED_TRANSPORT", message);
    }
}


