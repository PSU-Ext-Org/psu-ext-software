package com.psuext.transport.core.model;

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

/**
 * Connection request passed from the browser-facing bridge to a SCPI transport.
 *
 * @param host optional TCP target host
 * @param port optional TCP target port
 * @param serialPort optional USB serial port name
 * @param baudrate optional USB serial baud rate
 */
public record ScpiConnectionRequest(
        String host,
        Integer port,
        String serialPort,
        Integer baudrate) {

    /**
     * Creates a TCP-targeted connection request.
     *
     * @param host optional TCP target host
     * @param port optional TCP target port
     */
    public ScpiConnectionRequest(String host, Integer port) {
        this(host, port, null, null);
    }

    /**
     * Creates a USB-targeted connection request.
     *
     * @param serialPort USB serial port name
     * @param baudrate USB serial baud rate
     * @return USB connection request
     */
    public static ScpiConnectionRequest usb(String serialPort, Integer baudrate) {
        return new ScpiConnectionRequest(null, null, serialPort, baudrate);
    }

    /**
     * Returns whether this request contains a complete explicit TCP target.
     *
     * @return {@code true} when both host and port were supplied
     */
    public boolean hasExplicitTcpTarget() {
        return host != null && !host.isBlank() && port != null;
    }

    /**
     * Returns whether this request contains a complete USB target.
     *
     * @return {@code true} when serial port and baud rate were supplied
     */
    public boolean hasUsbTarget() {
        return serialPort != null && !serialPort.isBlank() && baudrate != null;
    }

    /**
     * Returns whether this request contains any complete transport target.
     *
     * @return {@code true} when either TCP or USB fields are complete
     */
    public boolean hasExplicitTarget() {
        return hasExplicitTcpTarget() || hasUsbTarget();
    }
}


