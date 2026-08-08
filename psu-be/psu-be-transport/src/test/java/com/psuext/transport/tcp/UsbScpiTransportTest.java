package com.psuext.transport.tcp;

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

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.SocketTimeoutException;
import java.time.Duration;
import java.util.List;

import com.psuext.transport.config.ScpiTcpResponseServiceConfig;
import com.psuext.transport.config.TransportProperties;
import com.psuext.transport.core.model.ScpiConnectionRequest;
import com.psuext.transport.core.model.ScpiTransportResponse;
import com.psuext.transport.core.model.ScpiTransportState;
import com.psuext.transport.core.UsbScpiTransport;
import com.psuext.transport.usb.PortBusyException;
import com.psuext.transport.usb.PortSession;
import com.psuext.transport.usb.PortSessionFactory;
import org.junit.jupiter.api.Test;

class UsbScpiTransportTest {

    private static final String IDN_RESPONSE = "PSU-EXT,PSU-EXT,TEST-0001,0.1.0";

    @Test
    void connectUsesConfiguredSerialPortAndBaudrate() {
        FakePortSession session = new FakePortSession(new ByteArrayInputStream(new byte[0]));
        CapturingPortSessionFactory factory = new CapturingPortSessionFactory(session);
        UsbScpiTransport transport = new UsbScpiTransport(properties(), responseHandler(), factory);

        ScpiTransportResponse response = transport.connect(ScpiConnectionRequest.usb("COM7", 115200));

        assertThat(response.message()).isEqualTo("CONNECTED transport=usb port=COM7 baudrate=115200");
        assertThat(factory.serialPort).isEqualTo("COM7");
        assertThat(factory.baudrate).isEqualTo(115200);
    }

    @Test
    void connectReturnsPortBusyErrorWhenPortAlreadyInUse() {
        UsbScpiTransport transport = new UsbScpiTransport(
                properties(),
                responseHandler(),
                new CapturingPortSessionFactory(new BusyPortSession()));

        ScpiTransportResponse response = transport.connect(ScpiConnectionRequest.usb("COM7", 115200));

        assertThat(response.code()).isEqualTo("PORT_BUSY");
        assertThat(response.message()).isEqualTo("Serial port COM7 is already in use by another process");
        assertThat(transport.status().state()).isEqualTo(ScpiTransportState.DISCONNECTED);
    }

    @Test
    void queryReturnsTextReply() {
        FakePortSession session = new FakePortSession(new ByteArrayInputStream((IDN_RESPONSE + "\n").getBytes()));
        UsbScpiTransport transport = new UsbScpiTransport(
                properties(),
                responseHandler(),
                new CapturingPortSessionFactory(session));
        transport.connect(ScpiConnectionRequest.usb("COM7", 115200));

        ScpiTransportResponse response = transport.send("*IDN?");

        assertThat(response)
                .isInstanceOfSatisfying(
                        ScpiTransportResponse.Text.class,
                        text -> assertThat(text.rawResponse()).isEqualTo(IDN_RESPONSE));
        assertThat(session.writtenText()).isEqualTo("*IDN?\n");
    }

    @Test
    void queryReturnsBinaryReply() {
        byte[] binaryBlock = new byte[] {'#', '1', '4', 0x01, 0x02, 0x03, 0x04};
        FakePortSession session = new FakePortSession(new ByteArrayInputStream(binaryBlock));
        UsbScpiTransport transport = new UsbScpiTransport(
                properties(),
                responseHandler(),
                new CapturingPortSessionFactory(session));
        transport.connect(ScpiConnectionRequest.usb("COM7", 115200));

        ScpiTransportResponse response = transport.send("MEAS:VOLT:DATA? CH1");

        assertThat(response)
                .isInstanceOfSatisfying(
                        ScpiTransportResponse.Binary.class,
                        binary -> assertThat(binary.binaryResponse()).isEqualTo(binaryBlock));
    }

    @Test
    void commandWithoutQuestionMarkDoesNotWaitForReply() {
        FakePortSession session = new FakePortSession(new ByteArrayInputStream(new byte[0]));
        UsbScpiTransport transport = new UsbScpiTransport(
                properties(),
                responseHandler(),
                new CapturingPortSessionFactory(session));
        transport.connect(ScpiConnectionRequest.usb("COM7", 115200));

        ScpiTransportResponse response = transport.send("OUTP ON");

        assertThat(response.message()).isEqualTo("SENT");
        assertThat(session.writtenText()).isEqualTo("OUTP ON\n");
    }

    @Test
    void commandWithoutQuestionMarkReturnsItsImmediateErrorReply() {
        FakePortSession session = new FakePortSession(new ByteArrayInputStream("ERR,\"bad command\"\n".getBytes()));
        UsbScpiTransport transport = new UsbScpiTransport(
                properties(),
                responseHandler(),
                new CapturingPortSessionFactory(session));
        transport.connect(ScpiConnectionRequest.usb("COM7", 115200));

        ScpiTransportResponse response = transport.send("OUTP BAD");

        assertThat(response.code()).isEqualTo("SCPI_ERROR");
        assertThat(response.message()).isEqualTo("ERR,\"bad command\"");
        assertThat(session.writtenText()).isEqualTo("OUTP BAD\n");
    }

    @Test
    void timeoutAtThresholdDisconnectsTransport() {
        FakePortSession session = new FakePortSession(new TimeoutInputStream());
        UsbScpiTransport transport = new UsbScpiTransport(
                properties(2),
                responseHandler(),
                new CapturingPortSessionFactory(session));
        transport.connect(ScpiConnectionRequest.usb("COM7", 115200));

        assertThat(transport.send("SLOW?").code()).isEqualTo("TIMEOUT");
        assertThat(transport.send("SLOW?").code()).isEqualTo("TIMEOUT");
        assertThat(transport.status().state()).isEqualTo(ScpiTransportState.DISCONNECTED);
    }

    private static TransportProperties properties() {
        return properties(3);
    }

    private static TransportProperties properties(int timeoutDisconnectThreshold) {
        TransportProperties properties = new TransportProperties();
        properties.setUsb(new TransportProperties.Usb(
                null,
                Duration.ofMillis(200),
                Duration.ofMillis(200),
                timeoutDisconnectThreshold,
                "\n",
                "\n"));
        return properties;
    }

    private static ScpiTcpResponseHandler responseHandler() {
        return new ScpiTcpResponseHandler(new ScpiTcpResponseServiceConfig().scpiTcpResponseServiceMap(List.of(
                new TextScpiTcpResponseService(),
                new BinaryScpiTcpResponseService())));
    }

    private static final class CapturingPortSessionFactory implements PortSessionFactory {

        private final PortSession session;
        private String serialPort;
        private int baudrate;

        private CapturingPortSessionFactory(PortSession session) {
            this.session = session;
        }

        @Override
        public PortSession create(String serialPort, int baudrate, TransportProperties.Usb properties) {
            this.serialPort = serialPort;
            this.baudrate = baudrate;
            return session;
        }
    }

    private static final class BusyPortSession implements PortSession {

        @Override
        public void open() {
            throw new PortBusyException("COM7");
        }

        @Override
        public void close() {
        }

        @Override
        public boolean isOpen() {
            return false;
        }

        @Override
        public InputStream inputStream() {
            throw new UnsupportedOperationException();
        }

        @Override
        public OutputStream outputStream() {
            throw new UnsupportedOperationException();
        }
    }

    private static final class FakePortSession implements PortSession {

        private final InputStream inputStream;
        private final ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        private boolean open;

        private FakePortSession(InputStream inputStream) {
            this.inputStream = inputStream;
        }

        @Override
        public void open() {
            open = true;
        }

        @Override
        public void close() {
            open = false;
        }

        @Override
        public boolean isOpen() {
            return open;
        }

        @Override
        public InputStream inputStream() {
            return inputStream;
        }

        @Override
        public OutputStream outputStream() {
            return outputStream;
        }

        private String writtenText() {
            return outputStream.toString();
        }
    }

    private static final class TimeoutInputStream extends InputStream {

        @Override
        public int read() throws IOException {
            throw new SocketTimeoutException("Read timed out");
        }
    }
}
