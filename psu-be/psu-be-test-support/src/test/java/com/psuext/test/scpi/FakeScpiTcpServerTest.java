package com.psuext.test.scpi;

/*-
 * #%L
 * PSU-BE Test Support
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

class FakeScpiTcpServerTest {

    private static final String IDN_RESPONSE = "PSU-EXT,PSU-EXT,TEST-0001,0.1.0";

    @Test
    void startsOnEphemeralPortAndRecordsCommands() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start()) {
            sendCommand(server.port(), "OUTP ON");

            assertThat(server.port()).isPositive();
            assertThat(server.commandObserved()).isTrue();
            assertThat(server.commands()).containsExactly("OUTP ON");
        }
    }

    @Test
    void returnsConfiguredTextResponseForExactQuery() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start()) {
            server.respondTo("*IDN?", IDN_RESPONSE);

            assertThat(query(server.port(), "*IDN?")).isEqualTo(IDN_RESPONSE);
            assertThat(server.commands()).containsExactly("*IDN?");
        }
    }

    @Test
    void returnsConfiguredBinaryResponseForExactQuery() throws Exception {
        byte[] binaryBlock = new byte[] {'#', '1', '3', 1, 2, 3};
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start()) {
            server.respondBinaryTo("DATA?", binaryBlock);

            try (Socket socket = new Socket("127.0.0.1", server.port())) {
                socket.getOutputStream().write("DATA?\n".getBytes(StandardCharsets.UTF_8));
                socket.getOutputStream().flush();

                assertThat(socket.getInputStream().readNBytes(binaryBlock.length)).isEqualTo(binaryBlock);
            }
        }
    }

    @Test
    void unknownQueryReceivesNoResponse() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start();
                Socket socket = new Socket("127.0.0.1", server.port())) {
            socket.setSoTimeout(100);
            socket.getOutputStream().write("UNKNOWN?\n".getBytes(StandardCharsets.UTF_8));
            socket.getOutputStream().flush();

            assertThatThrownBy(() -> socket.getInputStream().readNBytes(1))
                    .isInstanceOf(SocketTimeoutException.class);
            assertThat(server.commands()).containsExactly("UNKNOWN?");
        }
    }

    @Test
    void nonQueryCommandReceivesNoResponse() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start();
                Socket socket = new Socket("127.0.0.1", server.port())) {
            server.respondTo("OUTP ON", "OK");
            socket.setSoTimeout(100);
            socket.getOutputStream().write("OUTP ON\n".getBytes(StandardCharsets.UTF_8));
            socket.getOutputStream().flush();

            assertThatThrownBy(() -> socket.getInputStream().readNBytes(1))
                    .isInstanceOf(SocketTimeoutException.class);
            assertThat(server.commands()).containsExactly("OUTP ON");
        }
    }

    @Test
    void responseConfigurationCanChangeWhileRunning() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start()) {
            server.respondTo("MEAS:VOLT?", "1.0");
            assertThat(query(server.port(), "MEAS:VOLT?")).isEqualTo("1.0");

            server.respondTo("MEAS:VOLT?", "2.0");
            assertThat(query(server.port(), "MEAS:VOLT?")).isEqualTo("2.0");

            server.clearCommands();
            assertThat(server.commands()).isEmpty();
        }
    }

    private static void sendCommand(int port, String command) throws Exception {
        try (Socket socket = new Socket("127.0.0.1", port);
                BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(
                        socket.getOutputStream(),
                        StandardCharsets.UTF_8))) {
            writer.write(command);
            writer.write('\n');
            writer.flush();
        }
    }

    private static String query(int port, String command) throws Exception {
        try (Socket socket = new Socket("127.0.0.1", port);
                BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(
                        socket.getOutputStream(),
                        StandardCharsets.UTF_8));
                BufferedReader reader = new BufferedReader(new InputStreamReader(
                        socket.getInputStream(),
                        StandardCharsets.UTF_8))) {
            writer.write(command);
            writer.write('\n');
            writer.flush();
            return reader.readLine();
        }
    }
}
