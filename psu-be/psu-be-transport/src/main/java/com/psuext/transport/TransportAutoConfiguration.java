package com.psuext.transport;

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

import com.psuext.transport.config.ScpiTcpResponseServiceConfig;
import com.psuext.transport.config.TransportProperties;
import com.psuext.transport.core.ScpiTransportFactory;
import com.psuext.transport.tcp.ScpiTcpResponseHandler;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Import;

/**
 * Auto-configures shared SCPI transport beans.
 */
@AutoConfiguration
@ComponentScan(basePackageClasses = {
        ScpiTransportFactory.class,
        ScpiTcpResponseHandler.class
})
@Import(ScpiTcpResponseServiceConfig.class)
@EnableConfigurationProperties(TransportProperties.class)
public class TransportAutoConfiguration {
}

