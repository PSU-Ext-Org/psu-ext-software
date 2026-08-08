package com.psuext.connection;

/*-
 * #%L
 * PSU-BE Connection
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

import com.psuext.connection.config.ConnectionProperties;
import com.psuext.connection.config.JsonConfig;
import com.psuext.connection.data.BinaryDataFrameParser;
import com.psuext.connection.device.JsonDeviceConnectionDao;
import com.psuext.connection.service.ConnectionManagementService;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Import;

/**
 * Auto-configures shared connection-management beans.
 */
@AutoConfiguration
@ComponentScan(basePackageClasses = {
        ConnectionManagementService.class,
        JsonDeviceConnectionDao.class,
        BinaryDataFrameParser.class
})
@Import(JsonConfig.class)
@EnableConfigurationProperties(ConnectionProperties.class)
public class ConnectionAutoConfiguration {
}

