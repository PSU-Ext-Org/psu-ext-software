package com.psuext.connection.device;

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

/**
 * Persisted device connection profile.
 *
 * @param id generated device id in the {@code 0..255} range
 * @param name unique uppercase alphanumeric name, up to 8 characters
 * @param type connection transport type
 * @param ip TCP host or IP address; unused by USB
 * @param port TCP port number or USB serial port name
 * @param baudrate USB serial baud rate; unused by TCP
 */
public record DeviceConnection(
        int id,
        String name,
        DeviceConnectionType type,
        String ip,
        String port,
        Integer baudrate) {
}


