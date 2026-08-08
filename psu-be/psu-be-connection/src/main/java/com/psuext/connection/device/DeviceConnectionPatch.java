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
 * Partial update for a persisted device connection profile.
 *
 * @param name replacement name, or {@code null} to keep the current value
 * @param type replacement type, or {@code null} to keep the current value
 * @param ip replacement TCP IP/host, or {@code null} to keep the current value
 * @param port replacement TCP/USB port, or {@code null} to keep the current value
 * @param baudrate replacement USB baud rate, or {@code null} to keep the current value
 */
public record DeviceConnectionPatch(
        String name,
        DeviceConnectionType type,
        String ip,
        String port,
        Integer baudrate) {
}


