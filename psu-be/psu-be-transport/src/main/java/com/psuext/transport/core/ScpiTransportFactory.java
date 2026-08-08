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

import com.psuext.transport.config.TransportProperties;
import com.psuext.transport.tcp.ScpiTcpResponseHandler;
import com.psuext.transport.usb.JSerialCommPortSessionFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/**
 * Creates fresh transport instances for live device sessions.
 */
@Component
public class ScpiTransportFactory {

    private final TransportProperties properties;
    private final ApplicationEventPublisher eventPublisher;
    private final ScpiTcpResponseHandler responseHandler;

    /**
     * Creates the transport factory.
     *
     * @param properties proxy configuration
     * @param eventPublisher Spring event publisher for TCP connection factories
     * @param responseHandler typed TCP response handler
     */
    public ScpiTransportFactory(
            TransportProperties properties,
            ApplicationEventPublisher eventPublisher,
            ScpiTcpResponseHandler responseHandler) {
        this.properties = properties;
        this.eventPublisher = eventPublisher;
        this.responseHandler = responseHandler;
    }

    /**
     * Creates a transport for a configured device transport type.
     *
     * @param transportType configured device transport type, such as
     *                      {@code TCP} or {@code USB}
     * @return fresh transport instance
     */
    public ScpiTransport create(String transportType) {
        if ("TCP".equalsIgnoreCase(transportType)) {
            return new TcpScpiTransport(properties, eventPublisher, responseHandler);
        }
        if ("USB".equalsIgnoreCase(transportType)) {
            return new UsbScpiTransport(properties, responseHandler, new JSerialCommPortSessionFactory());
        }
        return new UnsupportedScpiTransport("Unsupported transport type: " + transportType);
    }
}


