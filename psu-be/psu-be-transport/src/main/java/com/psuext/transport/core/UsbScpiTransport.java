package com.psuext.transport.core;

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

import java.io.IOException;
import java.io.InputStream;
import java.io.InterruptedIOException;
import java.io.OutputStream;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.locks.LockSupport;
import java.util.regex.Pattern;

import com.psuext.transport.config.TransportProperties;
import com.psuext.transport.core.model.ScpiConnectionRequest;
import com.psuext.transport.core.model.ScpiTransportResponse;
import com.psuext.transport.core.model.ScpiTransportState;
import com.psuext.transport.core.model.ScpiTransportStatus;
import com.psuext.transport.tcp.ScpiResponseDeserializer;
import com.psuext.transport.tcp.ScpiTcpResponse;
import com.psuext.transport.tcp.ScpiTcpResponseHandler;
import com.psuext.transport.usb.PortBusyException;
import com.psuext.transport.usb.PortSession;
import com.psuext.transport.usb.PortSessionFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * USB CDC serial implementation of {@link ScpiTransport}.
 *
 * <p>The transport opens one configured serial port at a time. The serial port
 * name and baud rate come from the persisted device profile resolved by the
 * connection layer.
 */
public class UsbScpiTransport implements ScpiTransport {

    private static final Logger LOGGER = LoggerFactory.getLogger(UsbScpiTransport.class);
    private static final Pattern QUERY_HEADER_PATTERN = Pattern.compile("^\\s*\\S*\\?.*");

    private final TransportProperties properties;
    private final ScpiTcpResponseHandler responseHandler;
    private final PortSessionFactory portSessionFactory;
    private PortSession session;
    private ScpiTransportState state = ScpiTransportState.DISCONNECTED;
    private String serialPort;
    private Integer baudrate;
    private String lastError;
    private int consecutiveTimeouts;

    /**
     * Creates the USB SCPI transport.
     *
     * @param properties shared transport configuration
     * @param responseHandler typed SCPI response handler
     * @param portSessionFactory serial port session factory
     */
    public UsbScpiTransport(
            TransportProperties properties,
            ScpiTcpResponseHandler responseHandler,
            PortSessionFactory portSessionFactory) {
        this.properties = properties;
        this.responseHandler = responseHandler;
        this.portSessionFactory = portSessionFactory;
    }

    @Override
    public synchronized ScpiTransportResponse connect(ScpiConnectionRequest request) {
        if (request == null || !request.hasUsbTarget()) {
            return ScpiTransportResponse.error("BAD_TARGET", "USB serial port and baudrate are required");
        }
        LOGGER.debug("USB connect requested: port={} baudrate={}", request.serialPort(), request.baudrate());
        if (state == ScpiTransportState.CONNECTED
                && session != null
                && session.isOpen()
                && request.serialPort().equalsIgnoreCase(serialPort)
                && request.baudrate().equals(baudrate)) {
            consecutiveTimeouts = 0;
            return connectedResponse();
        }

        disconnectInternal();
        state = ScpiTransportState.CONNECTING;
        serialPort = request.serialPort();
        baudrate = request.baudrate();
        lastError = null;

        try {
            session = portSessionFactory.create(serialPort, baudrate, properties.usb());
            session.open();
            state = ScpiTransportState.CONNECTED;
            consecutiveTimeouts = 0;
            LOGGER.debug("USB connected: port={} baudrate={}", serialPort, baudrate);
            return connectedResponse();
        } catch (PortBusyException ex) {
            return failConnect(ex, "PORT_BUSY");
        } catch (Exception ex) {
            disconnectInternal();
            return failConnect(ex, "CONNECT_FAILED");
        }
    }

    @Override
    public synchronized ScpiTransportResponse disconnect() {
        LOGGER.debug("USB disconnect requested: port={} baudrate={}", serialPort, baudrate);
        disconnectInternal();
        state = ScpiTransportState.DISCONNECTED;
        lastError = null;
        consecutiveTimeouts = 0;
        return ScpiTransportResponse.ok("DISCONNECTED");
    }

    @Override
    public synchronized ScpiTransportStatus status() {
        refreshOpenState();
        return new ScpiTransportStatus(state, "usb", null, lastError);
    }

    @Override
    public synchronized ScpiTransportResponse send(String command) {
        refreshOpenState();
        if (state != ScpiTransportState.CONNECTED || session == null || !session.isOpen()) {
            return ScpiTransportResponse.error("DISCONNECTED", "USB transport is not connected");
        }

        String framedCommand = command + properties.usb().lineEnding();
        try {
            LOGGER.debug(
                    "USB send: port={} query={} command={}",
                    serialPort,
                    isQuery(command),
                    sanitize(command));
            //noinspection resource -- the PortSession owns this stream and closes it with the serial port.
            OutputStream outputStream = session.outputStream();
            outputStream.write(framedCommand.getBytes(StandardCharsets.UTF_8));
            outputStream.flush();

            if (!isQuery(command)) {
                clearTimeouts();
                ScpiTransportResponse writeResponse = readUnexpectedWriteResponse();
                if (writeResponse != null) {
                    LOGGER.debug("USB write returned unexpected response: port={} command={}",
                            serialPort, sanitize(command));
                    return writeResponse;
                }
                LOGGER.debug("USB command completed without response: port={} command={}", serialPort, sanitize(command));
                return ScpiTransportResponse.ok("SENT");
            }

            ScpiTcpResponse response = responseDeserializer().deserialize(session.inputStream());
            clearTimeouts();
            ScpiTransportResponse handled = responseHandler.handle(response, properties.usb().responseDelimiter());
            logResponse(handled);
            return handled;
        } catch (Exception ex) {
            lastError = safeMessage(ex);
            if (isTimeout(ex)) {
                LOGGER.debug("USB query timeout: port={} command={} error={}", serialPort, sanitize(command), lastError);
                return recordTimeout(lastError);
            }
            LOGGER.debug("USB connection lost: port={} command={} error={}", serialPort, sanitize(command), lastError);
            disconnectInternal();
            state = ScpiTransportState.DISCONNECTED;
            consecutiveTimeouts = 0;
            return ScpiTransportResponse.error("CONNECTION_LOST", lastError);
        }
    }

    private boolean isQuery(String command) {
        return QUERY_HEADER_PATTERN.matcher(command).matches();
    }

    private ScpiResponseDeserializer responseDeserializer() {
        return new ScpiResponseDeserializer(properties.usb().responseDelimiter());
    }

    private ScpiTransportResponse readUnexpectedWriteResponse() throws IOException {
        long timeoutNanos = properties.usb().writeResponseTimeout().toNanos();
        long deadline = System.nanoTime() + timeoutNanos;
        InputStream inputStream = session.inputStream();
        while (inputStream.available() == 0 && System.nanoTime() < deadline) {
            LockSupport.parkNanos(Math.min(5_000_000L, Math.max(1L, timeoutNanos)));
            if (Thread.interrupted()) {
                Thread.currentThread().interrupt();
                throw new InterruptedIOException("Interrupted while waiting for USB write response");
            }
        }
        if (inputStream.available() == 0) {
            return null;
        }

        ScpiTransportResponse response = responseHandler.handle(
                responseDeserializer().deserialize(inputStream), properties.usb().responseDelimiter());
        if (response instanceof ScpiTransportResponse.Text text) {
            String code = text.rawResponse().trim().startsWith("ERR,")
                    ? "SCPI_ERROR"
                    : "UNEXPECTED_WRITE_RESPONSE";
            return ScpiTransportResponse.error(code, text.rawResponse());
        }
        return ScpiTransportResponse.error("UNEXPECTED_WRITE_RESPONSE",
                "Write command returned a binary response");
    }

    private ScpiTransportResponse connectedResponse() {
        return ScpiTransportResponse.ok("CONNECTED transport=usb port=" + serialPort + " baudrate=" + baudrate);
    }

    private void refreshOpenState() {
        if (state == ScpiTransportState.CONNECTED && (session == null || !session.isOpen())) {
            state = ScpiTransportState.DISCONNECTED;
            consecutiveTimeouts = 0;
        }
    }

    private ScpiTransportResponse recordTimeout(String message) {
        consecutiveTimeouts++;
        lastError = message;
        if (consecutiveTimeouts >= properties.usb().timeoutDisconnectThreshold()) {
            disconnectInternal();
            state = ScpiTransportState.DISCONNECTED;
            consecutiveTimeouts = 0;
        }
        return ScpiTransportResponse.error("TIMEOUT", message);
    }

    private void clearTimeouts() {
        consecutiveTimeouts = 0;
        lastError = null;
    }

    private void disconnectInternal() {
        if (session != null) {
            session.close();
            session = null;
        }
    }

    private String safeMessage(Exception ex) {
        String message = ex.getMessage();
        if (message == null || message.isBlank()) {
            return ex.getClass().getSimpleName();
        }
        return message.replace('\n', ' ').replace('\r', ' ');
    }

    private ScpiTransportResponse failConnect(Exception ex, String code) {
        lastError = safeMessage(ex);
        LOGGER.debug("USB connect failed: port={} baudrate={} code={} error={}", serialPort, baudrate, code, lastError);
        state = ScpiTransportState.DISCONNECTED;
        consecutiveTimeouts = 0;
        return ScpiTransportResponse.error(code, lastError);
    }

    private boolean isTimeout(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            if (current instanceof SocketTimeoutException) {
                return true;
            }
            String message = current.getMessage();
            if (message != null && message.toLowerCase(Locale.ROOT).contains("timed out")) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private void logResponse(ScpiTransportResponse response) {
        if (response instanceof ScpiTransportResponse.Text text) {
            LOGGER.debug("USB response text: port={} payload={}", serialPort, sanitize(text.rawResponse()));
            return;
        }
        if (response instanceof ScpiTransportResponse.Binary binary) {
            LOGGER.debug("USB response binary: port={} bytes={}", serialPort, binary.binaryResponse().length);
            return;
        }
        if (response instanceof ScpiTransportResponse.Control control) {
            LOGGER.debug("USB response control: port={} payload={}", serialPort, sanitize(control.message()));
            return;
        }
        ScpiTransportResponse.Error error = (ScpiTransportResponse.Error) response;
        LOGGER.debug("USB response error: port={} code={} message={}", serialPort, error.code(), sanitize(error.message()));
    }

    private String sanitize(String value) {
        if (value == null) {
            return "";
        }
        return value.replace('\n', ' ').replace('\r', ' ');
    }
}
