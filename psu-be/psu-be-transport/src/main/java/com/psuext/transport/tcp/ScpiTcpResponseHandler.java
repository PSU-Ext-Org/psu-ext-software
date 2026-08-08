package com.psuext.transport.tcp;

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

import java.util.Map;

import com.psuext.transport.core.model.ScpiTransportResponse;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

/**
 * Routes typed TCP responses to the matching response handling service.
 */
@Component
public class ScpiTcpResponseHandler {

    private final Map<Class<? extends ScpiTcpResponse>, ScpiTcpResponseService<?>> services;

    /**
     * Creates the response handler.
     *
     * @param services typed response handling service map
     */
    public ScpiTcpResponseHandler(
            @Qualifier("scpiTcpResponseServiceMap")
            Map<Class<? extends ScpiTcpResponse>, ScpiTcpResponseService<?>> services) {
        this.services = Map.copyOf(services);
    }

    /**
     * Handles one typed TCP response.
     *
     * @param response typed response read from the TCP stream
     * @param delimiter configured text response delimiter
     * @return transport response
     */
    public ScpiTransportResponse handle(ScpiTcpResponse response, String delimiter) {
        return service(response).handle(response, delimiter);
    }

    @SuppressWarnings("unchecked")
    private <T extends ScpiTcpResponse> ScpiTcpResponseService<T> service(T response) {
        ScpiTcpResponseService<?> service = services.get(response.getClass());
        if (service == null) {
            throw new IllegalStateException("No SCPI TCP response service for " + response.getClass().getName());
        }
        return (ScpiTcpResponseService<T>) service;
    }
}


