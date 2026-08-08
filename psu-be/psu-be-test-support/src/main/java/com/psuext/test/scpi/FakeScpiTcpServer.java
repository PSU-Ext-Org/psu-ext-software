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

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;

/**
 * In-memory TCP SCPI server for backend tests.
 *
 * <p>The server accepts line-delimited SCPI commands, records each command, and
 * replies only to configured query commands. Response configuration can be
 * changed while the server is running and is never persisted.
 */
public final class FakeScpiTcpServer implements AutoCloseable {

    private static final Pattern QUERY_HEADER_PATTERN = Pattern.compile("^\\s*\\S*\\?.*");
    private static final Duration DEFAULT_WAIT = Duration.ofSeconds(1);

    private final ServerSocket serverSocket;
    private final Map<String, Response> responses = new ConcurrentHashMap<>();
    private final List<String> commands = new CopyOnWriteArrayList<>();
    private final List<Socket> sockets = new CopyOnWriteArrayList<>();
    private final List<Thread> connectionThreads = new CopyOnWriteArrayList<>();
    private final AtomicInteger acceptCount = new AtomicInteger();
    private final CountDownLatch closedConnection = new CountDownLatch(1);
    private final CountDownLatch commandReceived = new CountDownLatch(1);
    private volatile boolean running = true;
    private Thread acceptThread;

    private FakeScpiTcpServer(ServerSocket serverSocket) {
        this.serverSocket = serverSocket;
    }

    /**
     * Starts a fake server on an ephemeral TCP port.
     *
     * @return running fake SCPI server
     * @throws IOException when the server socket cannot be opened
     */
    public static FakeScpiTcpServer start() throws IOException {
        return start(0);
    }

    /**
     * Starts a fake server on a specific TCP port.
     *
     * @param port TCP port, or {@code 0} for an ephemeral port
     * @return running fake SCPI server
     * @throws IOException when the server socket cannot be opened
     */
    public static FakeScpiTcpServer start(int port) throws IOException {
        FakeScpiTcpServer server = new FakeScpiTcpServer(new ServerSocket(port));
        server.startAccepting();
        return server;
    }

    /**
     * Configures a text response for an exact query command.
     *
     * @param query SCPI query without line ending
     * @param response response text before the newline delimiter
     * @return this server for fluent test setup
     */
    public FakeScpiTcpServer respondTo(String query, String response) {
        responses.put(query, new TextResponse(response));
        return this;
    }

    /**
     * Configures a binary response for an exact query command.
     *
     * @param query SCPI query without line ending
     * @param response complete SCPI binary block
     * @return this server for fluent test setup
     */
    public FakeScpiTcpServer respondBinaryTo(String query, byte[] response) {
        responses.put(query, new BinaryResponse(response));
        return this;
    }

    /**
     * Configures a query to receive no response.
     *
     * @param query SCPI query without line ending
     * @return this server for fluent test setup
     */
    public FakeScpiTcpServer withoutResponse(String query) {
        responses.remove(query);
        return this;
    }

    /**
     * Returns the listening TCP port.
     *
     * @return server port
     */
    public int port() {
        return serverSocket.getLocalPort();
    }

    /**
     * Returns how many TCP connections have been accepted.
     *
     * @return accept count
     */
    public int acceptCount() {
        return acceptCount.get();
    }

    /**
     * Returns received commands in arrival order.
     *
     * @return command list
     */
    public List<String> commands() {
        return List.copyOf(commands);
    }

    /**
     * Clears recorded command history.
     */
    public void clearCommands() {
        commands.clear();
    }

    /**
     * Waits until at least one command has been observed.
     *
     * @return whether a command arrived before the default timeout
     * @throws InterruptedException when interrupted
     */
    public boolean commandObserved() throws InterruptedException {
        return commandObserved(DEFAULT_WAIT);
    }

    /**
     * Waits until at least one command has been observed.
     *
     * @param timeout maximum wait
     * @return whether a command arrived before the timeout
     * @throws InterruptedException when interrupted
     */
    public boolean commandObserved(Duration timeout) throws InterruptedException {
        return commandReceived.await(timeout.toMillis(), TimeUnit.MILLISECONDS);
    }

    /**
     * Waits until one accepted connection has closed.
     *
     * @return whether a close was observed before the default timeout
     * @throws InterruptedException when interrupted
     */
    public boolean closedConnectionObserved() throws InterruptedException {
        return closedConnectionObserved(DEFAULT_WAIT);
    }

    /**
     * Waits until one accepted connection has closed.
     *
     * @param timeout maximum wait
     * @return whether a close was observed before the timeout
     * @throws InterruptedException when interrupted
     */
    public boolean closedConnectionObserved(Duration timeout) throws InterruptedException {
        return closedConnection.await(timeout.toMillis(), TimeUnit.MILLISECONDS);
    }

    private void startAccepting() {
        acceptThread = new Thread(this::acceptLoop, "fake-scpi-tcp-server");
        acceptThread.start();
    }

    private void acceptLoop() {
        while (running) {
            try {
                Socket socket = serverSocket.accept();
                sockets.add(socket);
                acceptCount.incrementAndGet();
                Thread connectionThread = new Thread(() -> handle(socket), "fake-scpi-tcp-connection");
                connectionThreads.add(connectionThread);
                connectionThread.start();
            } catch (IOException ex) {
                if (running) {
                    throw new IllegalStateException(ex);
                }
            }
        }
    }

    private void handle(Socket socket) {
        try (socket;
                BufferedReader reader = new BufferedReader(new InputStreamReader(
                        socket.getInputStream(),
                        StandardCharsets.UTF_8));
                BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(
                        socket.getOutputStream(),
                        StandardCharsets.UTF_8))) {
            OutputStream outputStream = socket.getOutputStream();
            String line;
            while ((line = reader.readLine()) != null) {
                commands.add(line);
                commandReceived.countDown();
                if (isQuery(line)) {
                    Response response = responses.get(line);
                    if (response != null) {
                        response.writeTo(writer, outputStream);
                    }
                }
            }
        } catch (IOException ex) {
            if (running) {
                throw new IllegalStateException(ex);
            }
        } finally {
            sockets.remove(socket);
            closedConnection.countDown();
        }
    }

    private boolean isQuery(String command) {
        return QUERY_HEADER_PATTERN.matcher(command).matches();
    }

    @Override
    public void close() throws Exception {
        running = false;
        serverSocket.close();
        for (Socket socket : sockets) {
            socket.close();
        }
        if (acceptThread != null) {
            acceptThread.join(1000);
        }
        for (Thread connectionThread : connectionThreads) {
            connectionThread.join(1000);
        }
    }

    private sealed interface Response permits TextResponse, BinaryResponse {
        void writeTo(BufferedWriter writer, OutputStream outputStream) throws IOException;
    }

    private record TextResponse(String value) implements Response {
        @Override
        public void writeTo(BufferedWriter writer, OutputStream outputStream) throws IOException {
            writer.write(value);
            writer.write('\n');
            writer.flush();
        }
    }

    private record BinaryResponse(byte[] value) implements Response {
        private BinaryResponse(byte[] value) {
            this.value = Arrays.copyOf(value, value.length);
        }

        @Override
        public byte[] value() {
            return Arrays.copyOf(value, value.length);
        }

        @Override
        public void writeTo(BufferedWriter writer, OutputStream outputStream) throws IOException {
            outputStream.write(value);
            outputStream.flush();
        }
    }
}
