package com.psuext.script.web.device.model;

/*-
 * #%L
 * PSU-BE Script Runner
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

import com.psuext.connection.device.DeviceConnectionType;

/**
 * HTTP shape reserved for future device profile creation and modification.
 * The corresponding endpoints currently return {@code 501 Not Implemented}.
 *
 * @param name device name
 * @param type device transport type
 * @param ip TCP host or IP address
 * @param port TCP port or USB serial port
 * @param baudrate USB serial baud rate
 */
public record DeviceProfileRequest(
        String name,
        DeviceConnectionType type,
        String ip,
        String port,
        Integer baudrate) {
}
