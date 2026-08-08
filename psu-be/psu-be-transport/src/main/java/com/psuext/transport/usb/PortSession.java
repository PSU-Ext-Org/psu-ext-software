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

import java.io.InputStream;
import java.io.OutputStream;

/**
 * Openable serial port session used by the USB transport.
 */
public interface PortSession {

    /**
     * Opens the configured serial port.
     */
    void open();

    /**
     * Closes the serial port if it is open.
     */
    void close();

    /**
     * Returns whether the serial port is open.
     *
     * @return whether the serial port is open
     */
    boolean isOpen();

    /**
     * Returns the serial input stream.
     *
     * @return serial input stream
     */
    InputStream inputStream();

    /**
     * Returns the serial output stream.
     *
     * @return serial output stream
     */
    OutputStream outputStream();
}
