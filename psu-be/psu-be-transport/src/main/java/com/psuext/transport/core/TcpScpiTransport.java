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

import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

import com.psuext.transport.config.TransportProperties;
import com.psuext.transport.core.model.*;
import com.psuext.transport.tcp.ScpiResponseDeserializer;
import com.psuext.transport.tcp.ScpiTcpResponse;
import com.psuext.transport.tcp.ScpiTcpResponseHandler;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.channel.QueueChannel;
import org.springframework.integration.ip.tcp.connection.AbstractClientConnectionFactory;
import org.springframework.integration.ip.tcp.connection.TcpConnection;
import org.springframework.integration.ip.tcp.connection.TcpNetClientConnectionFactory;
import org.springframework.integration.ip.tcp.serializer.ByteArrayRawSerializer;
import org.springframework.integration.ip.tcp.outbound.TcpOutboundGateway;
import org.springframework.integration.support.MessageBuilder;
import org.springframework.messaging.Message;

/**
 * TCP implementation of {@link ScpiTransport} backed by Spring Integration TCP.
 *
 * <p>The transport owns one active TCP target at a time. Connecting to a
 * different target tears down the current Spring Integration TCP resources and
 * creates a new request/reply path.
 */
public class TcpScpiTransport implements ScpiTransport {

    private static final Pattern QUERY_HEADER_PATTERN = Pattern.compile("^\\s*\\S*\\?.*");

    private final TransportProperties properties;
    private final ApplicationEventPublisher eventPublisher;
    private final ScpiTcpResponseHandler responseHandler;
    private AbstractClientConnectionFactory connectionFactory;
    private TcpOutboundGateway gateway;
    private DirectChannel requestChannel;
    private ScpiTransportState state = ScpiTransportState.DISCONNECTED;
    private ScpiTarget target;
    private String lastError;
    private int consecutiveTimeouts;

    /**
     * Creates the TCP SCPI transport.
     *
     * @param properties proxy configuration
     * @param eventPublisher Spring event publisher used by dynamic TCP factories
     * @param responseHandler typed TCP response handler
     */
    public TcpScpiTransport(
            TransportProperties properties,
            ApplicationEventPublisher eventPublisher,
            ScpiTcpResponseHandler responseHandler) {
        this.properties = properties;
        this.eventPublisher = eventPublisher;
        this.responseHandler = responseHandler;
    }

    /**
     * Connects to the requested TCP target, or configured defaults when the
     * request is empty.
     *
     * @param request optional host/port request
     * @return connection result
     */
    @Override
    public synchronized ScpiTransportResponse connect(ScpiConnectionRequest request) {
        ScpiTarget requestedTarget = resolveTarget(request);
        if (state == ScpiTransportState.CONNECTED && requestedTarget.equals(target)) {
            consecutiveTimeouts = 0;
            return connectedResponse();
        }

        disconnectInternal();
        state = ScpiTransportState.CONNECTING;
        target = requestedTarget;
        lastError = null;

        try {
            connectionFactory = new TcpNetClientConnectionFactory(requestedTarget.host(), requestedTarget.port());
            connectionFactory.setConnectTimeout((int) properties.tcp().connectTimeout().toMillis());
            connectionFactory.setSoTimeout((int) properties.tcp().readTimeout().toMillis());
            connectionFactory.setSingleUse(false);
            connectionFactory.setSerializer(ByteArrayRawSerializer.INSTANCE);
            connectionFactory.setDeserializer(responseDeserializer());
            connectionFactory.setApplicationEventPublisher(eventPublisher);
            connectionFactory.start();

            gateway = new TcpOutboundGateway();
            gateway.setConnectionFactory(connectionFactory);
            gateway.setRequestTimeout(properties.tcp().commandTimeout().toMillis());
            gateway.setRemoteTimeout(properties.tcp().commandTimeout().toMillis());
            gateway.start();

            requestChannel = new DirectChannel();
            requestChannel.subscribe(gateway);

            connectionFactory.getConnection();
            state = ScpiTransportState.CONNECTED;
            consecutiveTimeouts = 0;
            return connectedResponse();
        } catch (Exception ex) {
            lastError = safeMessage(ex);
            disconnectInternal();
            state = ScpiTransportState.DISCONNECTED;
            consecutiveTimeouts = 0;
            return ScpiTransportResponse.error("CONNECT_FAILED", lastError);
        }
    }

    /**
     * Closes the current TCP connection and associated Spring Integration
     * resources.
     *
     * @return disconnect result
     */
    @Override
    public synchronized ScpiTransportResponse disconnect() {
        disconnectInternal();
        state = ScpiTransportState.DISCONNECTED;
        lastError = null;
        consecutiveTimeouts = 0;
        return ScpiTransportResponse.ok("DISCONNECTED");
    }

    /**
     * Returns current TCP transport state.
     *
     * @return TCP status snapshot
     */
    @Override
    public synchronized ScpiTransportStatus status() {
        refreshOpenState();
        return new ScpiTransportStatus(state, "tcp", target, lastError);
    }

    /**
     * Sends one SCPI command over TCP. Commands whose header contains
     * {@code ?}, such as {@code *IDN?} or {@code OUTPut? CH1}, are treated as
     * queries and wait for one text-delimited reply or one SCPI definite-length
     * binary block; other commands are sent without waiting for a response.
     *
     * @param command raw SCPI command without TCP line ending
     * @return raw query reply, binary block, successful send, timeout,
     * disconnect, or connection-loss response
     */
    @Override
    public synchronized ScpiTransportResponse send(String command) {
        refreshOpenState();
        if (state != ScpiTransportState.CONNECTED || requestChannel == null) {
            return ScpiTransportResponse.error("DISCONNECTED", "TCP transport is not connected");
        }

        String framedCommand = command + properties.tcp().lineEnding();
        Message<byte[]> message = MessageBuilder.withPayload(framedCommand.getBytes(StandardCharsets.UTF_8)).build();
        try {
            if (!isQuery(command)) {
                TcpConnection connection = connectionFactory.getConnection();
                connection.send(message);
                clearTimeouts();
                return ScpiTransportResponse.ok("SENT");
            }

            ScpiTransportResponse response = sendQuery(message);
            if (response.ok()) {
                clearTimeouts();
                return response;
            }
            if ("TIMEOUT".equals(response.code())) {
                return recordTimeout(response.message());
            }
            return response;
        } catch (Exception ex) {
            lastError = safeMessage(ex);
            if (isTimeout(ex)) {
                return recordTimeout(lastError);
            }
            disconnectInternal();
            state = ScpiTransportState.DISCONNECTED;
            consecutiveTimeouts = 0;
            return ScpiTransportResponse.error("CONNECTION_LOST", lastError);
        }
    }

    private ScpiTransportResponse sendQuery(Message<byte[]> message) {
        QueueChannel replyChannel = new QueueChannel(1);
        Message<byte[]> queryMessage = MessageBuilder.fromMessage(message)
                .setReplyChannel(replyChannel)
                .build();
        boolean sent = requestChannel.send(queryMessage, properties.tcp().commandTimeout().toMillis());
        if (!sent) {
            return ScpiTransportResponse.error("TIMEOUT", "Command was not accepted before timeout");
        }
        Message<?> reply = replyChannel.receive(properties.tcp().commandTimeout().toMillis());
        if (reply == null) {
            return ScpiTransportResponse.error("TIMEOUT", "No response before command timeout");
        }
        return responseHandler.handle((ScpiTcpResponse) reply.getPayload(), properties.tcp().responseDelimiter());
    }

    private boolean isQuery(String command) {
        return QUERY_HEADER_PATTERN.matcher(command).matches();
    }

    private ScpiTarget resolveTarget(ScpiConnectionRequest request) {
        if (request != null && request.hasExplicitTcpTarget()) {
            return new ScpiTarget(request.host(), request.port());
        }
        return new ScpiTarget(properties.tcp().host(), properties.tcp().port());
    }

    private ScpiTransportResponse connectedResponse() {
        return ScpiTransportResponse.ok("CONNECTED transport=tcp host=" + target.host() + " port=" + target.port());
    }

    private void refreshOpenState() {
        if (state == ScpiTransportState.CONNECTED && (connectionFactory == null || !connectionFactory.isRunning())) {
            state = ScpiTransportState.DISCONNECTED;
            consecutiveTimeouts = 0;
        }
    }

    private ScpiTransportResponse recordTimeout(String message) {
        consecutiveTimeouts++;
        lastError = message;
        if (consecutiveTimeouts >= properties.tcp().timeoutDisconnectThreshold()) {
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
        if (gateway != null) {
            gateway.stop();
            gateway = null;
        }
        if (requestChannel != null) {
            requestChannel = null;
        }
        if (connectionFactory != null) {
            connectionFactory.stop();
            connectionFactory = null;
        }
    }

    private org.springframework.core.serializer.Deserializer<?> responseDeserializer() {
        return new ScpiResponseDeserializer(properties.tcp().responseDelimiter());
    }

    private String safeMessage(Exception ex) {
        String message = ex.getMessage();
        if (message == null || message.isBlank()) {
            return ex.getClass().getSimpleName();
        }
        return message.replace('\n', ' ').replace('\r', ' ');
    }

    private boolean isTimeout(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            if (current instanceof java.net.SocketTimeoutException) {
                return true;
            }
            String message = current.getMessage();
            if (message != null && message.toLowerCase(java.util.Locale.ROOT).contains("timed out")) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }
}


