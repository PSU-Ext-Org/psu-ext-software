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

import com.psuext.test.scpi.FakeScpiTcpServer;
import com.psuext.transport.config.ScpiTcpResponseServiceConfig;
import com.psuext.transport.config.TransportProperties;
import com.psuext.transport.core.model.ScpiConnectionRequest;
import com.psuext.transport.core.model.ScpiTransportResponse;
import com.psuext.transport.core.model.ScpiTransportState;
import com.psuext.transport.core.TcpScpiTransport;
import java.io.IOException;
import java.net.ServerSocket;
import java.time.Duration;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class TcpScpiTransportTest {

    private static final String IDN_RESPONSE = "PSU-EXT,PSU-EXT,TEST-0001,0.1.0";

    @Test
    void emptyConnectUsesConfiguredDefaultsAndSendsLineDelimitedCommand() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start().respondTo("*IDN?", IDN_RESPONSE)) {
            TcpScpiTransport transport = transport(server.port());

            assertThat(transport.connect(new ScpiConnectionRequest(null, null)).ok()).isTrue();
            assertTextResponse(transport.send("*IDN?"), IDN_RESPONSE);

            assertThat(server.commands()).containsExactly("*IDN?");
        }
    }

    @Test
    void sameTargetConnectIsNoOp() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start()) {
            TcpScpiTransport transport = transport(server.port());

            transport.connect(new ScpiConnectionRequest("127.0.0.1", server.port()));
            transport.connect(new ScpiConnectionRequest("127.0.0.1", server.port()));

            assertThat(server.acceptCount()).isEqualTo(1);
        }
    }

    @Test
    void differentTargetReconnectDropsOldConnection() throws Exception {
        try (FakeScpiTcpServer first = FakeScpiTcpServer.start();
                FakeScpiTcpServer second = FakeScpiTcpServer.start().respondTo("PING?", "SECOND")) {
            TcpScpiTransport transport = new TcpScpiTransport(properties(first.port()), event -> {
            }, responseHandler());

            transport.connect(new ScpiConnectionRequest("127.0.0.1", first.port()));
            transport.connect(new ScpiConnectionRequest("127.0.0.1", second.port()));

            assertTextResponse(transport.send("PING?"), "SECOND");
            assertThat(first.closedConnectionObserved()).isTrue();
        }
    }

    @Test
    void failedReconnectLeavesTransportDisconnected() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start()) {
            TcpScpiTransport transport = transport(server.port());
            transport.connect(new ScpiConnectionRequest("127.0.0.1", server.port()));

            assertThat(transport.connect(new ScpiConnectionRequest("127.0.0.1", unusedPort())).ok()).isFalse();

            assertThat(transport.status().state()).isEqualTo(ScpiTransportState.DISCONNECTED);
            assertThat(transport.send("*IDN?").code()).isEqualTo("DISCONNECTED");
        }
    }

    @Test
    void timeoutReturnsTimeoutErrorAndKeepsConnectedBeforeThreshold() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start()) {
            TcpScpiTransport transport = transport(server.port(), 2);
            transport.connect(new ScpiConnectionRequest(null, null));

            assertThat(transport.send("SLOW?").code()).isEqualTo("TIMEOUT");
            assertThat(transport.status().state()).isEqualTo(ScpiTransportState.CONNECTED);
        }
    }

    @Test
    void timeoutAtThresholdDisconnectsTransport() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start()) {
            TcpScpiTransport transport = transport(server.port(), 2);
            transport.connect(new ScpiConnectionRequest(null, null));

            assertThat(transport.send("SLOW?").code()).isEqualTo("TIMEOUT");
            assertThat(transport.send("SLOW?").code()).isEqualTo("TIMEOUT");

            assertThat(transport.status().state()).isEqualTo(ScpiTransportState.DISCONNECTED);
            assertThat(transport.send("SLOW?").code()).isEqualTo("DISCONNECTED");
        }
    }

    @Test
    void successfulCommandResetsTimeoutCount() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start()) {
            TcpScpiTransport transport = transport(server.port(), 2);
            transport.connect(new ScpiConnectionRequest(null, null));

            assertThat(transport.send("SLOW?").code()).isEqualTo("TIMEOUT");
            assertThat(transport.send("OUTP ON").ok()).isTrue();
            assertThat(transport.send("SLOW?").code()).isEqualTo("TIMEOUT");

            assertThat(transport.status().state()).isEqualTo(ScpiTransportState.CONNECTED);
        }
    }

    @Test
    void reconnectResetsTimeoutCount() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start()) {
            TcpScpiTransport transport = transport(server.port(), 2);
            ScpiConnectionRequest request = new ScpiConnectionRequest(null, null);
            transport.connect(request);

            assertThat(transport.send("SLOW?").code()).isEqualTo("TIMEOUT");
            assertThat(transport.connect(request).ok()).isTrue();
            assertThat(transport.send("SLOW?").code()).isEqualTo("TIMEOUT");

            assertThat(transport.status().state()).isEqualTo(ScpiTransportState.CONNECTED);
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "OUTPut? CH1",
            ":SOURce:VOLTage:SET? CH1",
            "MODE? CH2",
            "WAVE:DRAW? CH1,VOLT"
    })
    void commandWithQuestionMarkInHeaderAndArgumentsWaitsForReply(String command) throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start().respondTo(command, "ON")) {
            TcpScpiTransport transport = transport(server.port());
            transport.connect(new ScpiConnectionRequest(null, null));

            assertTextResponse(transport.send(command), "ON");

            assertThat(server.commands()).containsExactly(command);
        }
    }

    @Test
    void queryCanReturnBinaryDefiniteLengthBlockWithoutDelimiter() throws Exception {
        byte[] binaryBlock = new byte[] {'#', '2', '0', '8', 0, 0, 0, 1, 0x12, 0x34, 0x56, 0x78};
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start()
                .respondBinaryTo("MEAS:VOLT:DATA? CH1", binaryBlock)) {
            TcpScpiTransport transport = transport(server.port());
            transport.connect(new ScpiConnectionRequest(null, null));

            assertBinaryResponse(transport.send("MEAS:VOLT:DATA? CH1"), binaryBlock);

            assertThat(server.commands()).containsExactly("MEAS:VOLT:DATA? CH1");
        }
    }

    @Test
    void queryCanReturnEmptyBinaryDefiniteLengthBlock() throws Exception {
        byte[] binaryBlock = new byte[] {'#', '1', '0'};
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start()
                .respondBinaryTo("MEAS:VOLT:DATA? CH1,0", binaryBlock)) {
            TcpScpiTransport transport = transport(server.port());
            transport.connect(new ScpiConnectionRequest(null, null));

            assertBinaryResponse(transport.send("MEAS:VOLT:DATA? CH1,0"), binaryBlock);

            assertThat(server.commands()).containsExactly("MEAS:VOLT:DATA? CH1,0");
        }
    }

    @Test
    void commandWithoutQuestionMarkDoesNotWaitForReply() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start()) {
            TcpScpiTransport transport = transport(server.port());
            transport.connect(new ScpiConnectionRequest(null, null));

            assertThat(transport.send("OUTP ON"))
                    .satisfies(response -> {
                        assertThat(response.ok()).isTrue();
                        assertThat(response.message()).isEqualTo("SENT");
                    });

            assertThat(server.commandObserved()).isTrue();
            assertThat(server.commands()).containsExactly("OUTP ON");
        }
    }

    @Test
    void questionMarkOnlyInArgumentsDoesNotWaitForReply() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start()) {
            TcpScpiTransport transport = transport(server.port());
            transport.connect(new ScpiConnectionRequest(null, null));

            assertThat(transport.send("SYST:TEXT CH1,?"))
                    .satisfies(response -> {
                        assertThat(response.ok()).isTrue();
                        assertThat(response.message()).isEqualTo("SENT");
                    });

            assertThat(server.commandObserved()).isTrue();
            assertThat(server.commands()).containsExactly("SYST:TEXT CH1,?");
        }
    }

    private static TransportProperties properties(int port) {
        TransportProperties properties = new TransportProperties();
        properties.setTcp(new TransportProperties.Tcp(
                "127.0.0.1",
                port,
                Duration.ofSeconds(1),
                Duration.ofMillis(200),
                Duration.ofMillis(200),
                3,
                "\n",
                "\n"));
        return properties;
    }

    private static TcpScpiTransport transport(int port) {
        return new TcpScpiTransport(properties(port), event -> {
        }, responseHandler());
    }

    private static TcpScpiTransport transport(int port, int timeoutDisconnectThreshold) {
        TransportProperties properties = new TransportProperties();
        properties.setTcp(new TransportProperties.Tcp(
                "127.0.0.1",
                port,
                Duration.ofSeconds(1),
                Duration.ofMillis(200),
                Duration.ofMillis(200),
                timeoutDisconnectThreshold,
                "\n",
                "\n"));
        return new TcpScpiTransport(properties, event -> {
        }, responseHandler());
    }

    private static ScpiTcpResponseHandler responseHandler() {
        return new ScpiTcpResponseHandler(new ScpiTcpResponseServiceConfig().scpiTcpResponseServiceMap(List.of(
                new TextScpiTcpResponseService(),
                new BinaryScpiTcpResponseService())));
    }

    private static void assertTextResponse(ScpiTransportResponse response, String expected) {
        assertThat(response)
                .isInstanceOfSatisfying(
                        ScpiTransportResponse.Text.class,
                        text -> assertThat(text.rawResponse()).isEqualTo(expected));
    }

    private static void assertBinaryResponse(ScpiTransportResponse response, byte[] expected) {
        assertThat(response)
                .isInstanceOfSatisfying(
                        ScpiTransportResponse.Binary.class,
                        binary -> assertThat(binary.binaryResponse()).isEqualTo(expected));
    }

    private static int unusedPort() throws IOException {
        try (ServerSocket socket = new ServerSocket(0)) {
            return socket.getLocalPort();
        }
    }
}
