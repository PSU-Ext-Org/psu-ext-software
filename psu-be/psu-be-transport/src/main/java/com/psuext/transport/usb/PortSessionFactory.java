package com.psuext.transport.usb;

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

/**
 * Creates configured USB serial sessions for SCPI transport instances.
 */
public interface PortSessionFactory {

    /**
     * Creates a serial session for one configured USB target.
     *
     * @param serialPort serial port name, such as {@code COM3}
     * @param baudrate configured serial baud rate
     * @param properties shared USB transport settings
     * @return unopened serial session
     */
    PortSession create(String serialPort, int baudrate, TransportProperties.Usb properties);
}
