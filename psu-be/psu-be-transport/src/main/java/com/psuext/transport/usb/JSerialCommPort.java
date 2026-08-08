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
import java.util.EnumSet;

import com.fazecast.jSerialComm.SerialPort;

/**
 * Decorates jSerialComm's {@link SerialPort} with domain-specific state
 * inspection (e.g. whether a failed open was caused by the port already
 * being held by another process), so future state checks have one place
 * to live alongside the raw handle.
 */
final class JSerialCommPort {

    private final SerialPort port;
    private final String name;

    JSerialCommPort(SerialPort port, String name) {
        this.port = port;
        this.name = name;
    }

    String name() {
        return name;
    }

    boolean open() {
        return port.openPort();
    }

    void close() {
        if (port.isOpen()) {
            port.closePort();
        }
    }

    boolean isOpen() {
        return port.isOpen();
    }

    InputStream inputStream() {
        return port.getInputStream();
    }

    OutputStream outputStream() {
        return port.getOutputStream();
    }

    boolean isBusy() {
        return PortErrorCodes.isPortBusy(port.getLastErrorCode());
    }

    String lastErrorDescription() {
        return "error " + port.getLastErrorCode() + " at " + port.getLastErrorLocation();
    }

    /**
     * Native error codes jSerialComm surfaces when a port is already held
     * open by another process.
     *
     * <p>POSIX openPortNative() takes the port's flock() and stores errno as
     * the last error on failure; a port already held by another process
     * reports EAGAIN/EWOULDBLOCK (11 on Linux, 35 on macOS - both alias the
     * same value on their respective platforms). Windows CreateFile denies a
     * second handle with ERROR_ACCESS_DENIED (5).
     */
    private enum PortErrorCodes {

        ERRNO_EAGAIN_LINUX(11),
        ERRNO_EAGAIN_MACOS(35),
        WIN_ERROR_ACCESS_DENIED(5);

        private static final EnumSet<PortErrorCodes> BUSY_CODES =
                EnumSet.of(ERRNO_EAGAIN_LINUX, ERRNO_EAGAIN_MACOS, WIN_ERROR_ACCESS_DENIED);

        private final int code;

        PortErrorCodes(int code) {
            this.code = code;
        }

        static boolean isPortBusy(int errorCode) {
            return BUSY_CODES.stream().anyMatch(portErrorCode -> portErrorCode.code == errorCode);
        }
    }
}
