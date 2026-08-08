package com.psuext.proxy.test;

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

import com.psuext.transport.core.model.ScpiConnectionRequest;
import com.psuext.transport.core.model.ScpiTarget;
import com.psuext.transport.core.ScpiTransport;
import com.psuext.transport.core.model.ScpiTransportResponse;
import com.psuext.transport.core.model.ScpiTransportState;
import com.psuext.transport.core.model.ScpiTransportStatus;

/**
 * Test-only SCPI transport used by proxy adapter tests.
 */
final class ProxyTestScpiTransport implements ScpiTransport {

    private static final String IDN_RESPONSE = "PSU-EXT,PSU-EXT,TEST-0001,0.1.0";

    private final String echoPrefix;
    private final byte[] fixedBinaryResponse;
    private final String fixedTextResponse;
    private boolean connected;
    private ScpiTarget target;

    ProxyTestScpiTransport() {
        this(null, null, "12.34");
    }

    private ProxyTestScpiTransport(String echoPrefix, byte[] fixedBinaryResponse, String fixedTextResponse) {
        this.echoPrefix = echoPrefix;
        this.fixedBinaryResponse = fixedBinaryResponse == null
                ? null
                : Arrays.copyOf(fixedBinaryResponse, fixedBinaryResponse.length);
        this.fixedTextResponse = fixedTextResponse;
    }

    static ProxyTestScpiTransport echoing(String prefix) {
        return new ProxyTestScpiTransport(prefix, null, null);
    }

    static ProxyTestScpiTransport respondingWithBinary(byte[] response) {
        return new ProxyTestScpiTransport(null, response, null);
    }

    @Override
    public ScpiTransportResponse connect(ScpiConnectionRequest request) {
        connected = true;
        if (request.hasUsbTarget()) {
            target = null;
            return ScpiTransportResponse.ok(
                    "CONNECTED transport=fake port=" + request.serialPort() + " baudrate=" + request.baudrate());
        }
        target = new ScpiTarget(request.host(), request.port());
        return ScpiTransportResponse.ok("CONNECTED transport=fake host=" + target.host() + " port=" + target.port());
    }

    @Override
    public ScpiTransportResponse disconnect() {
        connected = false;
        return ScpiTransportResponse.ok("DISCONNECTED");
    }

    @Override
    public ScpiTransportStatus status() {
        return new ScpiTransportStatus(
                connected ? ScpiTransportState.CONNECTED : ScpiTransportState.DISCONNECTED,
                "fake",
                target,
                null);
    }

    @Override
    public ScpiTransportResponse send(String command) {
        if (!connected) {
            return ScpiTransportResponse.error("DISCONNECTED", "Device is not connected");
        }
        if (fixedBinaryResponse != null) {
            return ScpiTransportResponse.binary(fixedBinaryResponse);
        }
        if ("*IDN?".equals(command)) {
            return ScpiTransportResponse.raw(IDN_RESPONSE);
        }
        if (echoPrefix != null) {
            return ScpiTransportResponse.raw(echoPrefix + command);
        }
        return ScpiTransportResponse.raw(fixedTextResponse);
    }
}
