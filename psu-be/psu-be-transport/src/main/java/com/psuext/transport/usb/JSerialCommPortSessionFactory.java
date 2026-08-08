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

import com.fazecast.jSerialComm.SerialPort;
import com.psuext.transport.config.TransportProperties;

/**
 * Production serial session factory backed by jSerialComm.
 */
public class JSerialCommPortSessionFactory implements PortSessionFactory {

    @Override
    public PortSession create(String serialPort, int baudrate, TransportProperties.Usb properties) {
        JSerialCommNativeLibraryConfigurer.ensureConfigured(properties);
        SerialPort port = SerialPort.getCommPort(serialPort);
        port.setComPortParameters(baudrate, 8, SerialPort.ONE_STOP_BIT, SerialPort.NO_PARITY);
        port.setFlowControl(SerialPort.FLOW_CONTROL_DISABLED);
        // Semi-blocking reads let the deserializer accumulate chunked CDC traffic
        // without waiting for the full requested buffer size in one native read.
        port.setComPortTimeouts(
                SerialPort.TIMEOUT_READ_SEMI_BLOCKING | SerialPort.TIMEOUT_WRITE_BLOCKING,
                (int) properties.readTimeout().toMillis(),
                (int) properties.commandTimeout().toMillis());
        return new JSerialCommPortSession(new JSerialCommPort(port, serialPort));
    }

    private static final class JSerialCommPortSession implements PortSession {

        private final JSerialCommPort port;

        private JSerialCommPortSession(JSerialCommPort port) {
            this.port = port;
        }

        @Override
        public void open() {
            if (!port.open()) {
                if (port.isBusy()) {
                    throw new PortBusyException(port.name());
                }
                throw new IllegalStateException("Failed to open serial port " + port.name()
                        + " (" + port.lastErrorDescription() + ")");
            }
        }

        @Override
        public void close() {
            port.close();
        }

        @Override
        public boolean isOpen() {
            return port.isOpen();
        }

        @Override
        public InputStream inputStream() {
            return port.inputStream();
        }

        @Override
        public OutputStream outputStream() {
            return port.outputStream();
        }
    }
}
