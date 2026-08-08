package com.psuext.transport.config;

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

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.psuext.transport.tcp.ScpiTcpResponse;
import com.psuext.transport.tcp.ScpiTcpResponseService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Builds typed TCP response dispatch structures from Spring-managed response
 * service beans.
 */
@Configuration
public class ScpiTcpResponseServiceConfig {

    /**
     * Creates a response-service dispatch map keyed by typed TCP response class.
     *
     * @param services discovered typed TCP response service beans
     * @return immutable response-service map
     */
    @Bean
    public Map<Class<? extends ScpiTcpResponse>, ScpiTcpResponseService<?>> scpiTcpResponseServiceMap(
            List<ScpiTcpResponseService<?>> services) {
        return services.stream()
                .collect(Collectors.toUnmodifiableMap(
                        ScpiTcpResponseService::responseType,
                        Function.identity(),
                        this::duplicateService));
    }

    private ScpiTcpResponseService<?> duplicateService(
            ScpiTcpResponseService<?> first,
            ScpiTcpResponseService<?> second) {
        throw new IllegalStateException("Duplicate TCP response service: " + first.responseType().getName());
    }
}


