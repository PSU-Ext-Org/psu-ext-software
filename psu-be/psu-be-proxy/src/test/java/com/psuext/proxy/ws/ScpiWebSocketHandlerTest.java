package com.psuext.proxy.ws;

/*-
 * #%L
 * PSU-BE Proxy
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

import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.file.Path;
import java.security.Principal;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.psuext.proxy.scpi.ScpiBridgeService;
import com.psuext.proxy.test.FakeBackedBridgeFactory;
import org.jspecify.annotations.NullMarked;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpHeaders;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketExtension;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;

class ScpiWebSocketHandlerTest {

    private static final String IDN_RESPONSE = "PSU-EXT,PSU-EXT,TEST-0001,0.1.0";

    @TempDir
    Path tempDir;

    private ScpiWebSocketHandler handler;

    @BeforeEach
    void setUp() {
        ScpiBridgeService service = FakeBackedBridgeFactory.echoingBridge(tempDir.resolve("devices.json"), "reply:");
        handler = new ScpiWebSocketHandler(service, commandMap(service));
    }

    @Test
    void handlesDeviceCrudAndLifecycleMessages() throws Exception {
        TestSession session = new TestSession("a");

        handler.handleMessage(session, new TextMessage("REQ req-1 /device-add PSU1,TCP,10.0.0.5,5025,"));
        handler.handleMessage(session, new TextMessage("REQ req-2 /device-list"));
        handler.handleMessage(session, new TextMessage("REQ req-3 /device-modify PSU1,name=PSU2,ip=10.0.0.6"));
        handler.handleMessage(session, new TextMessage("REQ req-4 /connect PSU2"));
        handler.handleMessage(session, new TextMessage("REQ req-5 /status 0"));
        handler.handleMessage(session, new TextMessage("REQ req-6 /disconnect PSU2"));
        handler.handleMessage(session, new TextMessage("REQ req-7 /device-delete 0"));

        assertThat(session.textMessages()).containsExactly(
                "RES req-1 OK DEVICE_ADDED 0,PSU1,TCP,10.0.0.5,5025,",
                "RES req-2 0,PSU1,TCP,10.0.0.5,5025,",
                "RES req-3 OK DEVICE_MODIFIED 0,PSU2,TCP,10.0.0.6,5025,",
                "RES req-4 OK CONNECTED transport=fake host=10.0.0.6 port=5025",
                "RES req-5 STATUS id=0 name=PSU2 state=CONNECTED transport=tcp host=10.0.0.6 port=5025",
                "RES req-6 OK DISCONNECTED",
                "RES req-7 OK DEVICE_DELETED 0,PSU2,TCP,10.0.0.6,5025,");
    }

    @Test
    void supportsExplicitCmdAndSessionDefaultRawScpi() throws Exception {
        TestSession session = new TestSession("sender");
        handler.handleMessage(session, new TextMessage("REQ setup-1 /device-add PSU1,TCP,10.0.0.5,5025,"));
        handler.handleMessage(session, new TextMessage("REQ setup-2 /connect PSU1"));

        handler.handleMessage(session, new TextMessage("REQ cmd-1 CMD PSU1 *IDN?\n"));
        handler.handleMessage(session, new TextMessage("REQ cmd-2 MEAS:VOLT?\n"));

        assertThat(session.textMessages()).containsExactly(
                "RES setup-1 OK DEVICE_ADDED 0,PSU1,TCP,10.0.0.5,5025,",
                "RES setup-2 OK CONNECTED transport=fake host=10.0.0.5 port=5025",
                "RES cmd-1 " + IDN_RESPONSE,
                "RES cmd-2 reply:MEAS:VOLT?");
    }

    @Test
    void sendsBinaryScpiResponsesAsBinaryFrames() throws Exception {
        byte[] binaryBlock = new byte[] {'#', '1', '4', 0x01, 0x02, 0x03, 0x04};
        ScpiBridgeService service = FakeBackedBridgeFactory.binaryBridge(
                tempDir.resolve("binary-devices.json"),
                binaryBlock);
        handler = new ScpiWebSocketHandler(service, commandMap(service));
        TestSession session = new TestSession("binary");
        handler.handleMessage(session, new TextMessage("REQ setup-1 /device-add PSU1,TCP,10.0.0.5,5025,"));
        handler.handleMessage(session, new TextMessage("REQ setup-2 /connect PSU1"));

        handler.handleMessage(session, new TextMessage("REQ bin-1 CMD PSU1 MEAS:VOLT:DATA? CH1"));

        assertThat(session.textMessages()).containsExactly(
                "RES setup-1 OK DEVICE_ADDED 0,PSU1,TCP,10.0.0.5,5025,",
                "RES setup-2 OK CONNECTED transport=fake host=10.0.0.5 port=5025",
                "BIN bin-1 " + Base64.getEncoder().encodeToString(binaryBlock));
    }

    @Test
    void rejectsBadSyntaxAndUnknownDevices() throws Exception {
        TestSession session = new TestSession("a");

        handler.handleMessage(session, new TextMessage("REQ bad-1 /device-add BAD,TCP,127.0.0.1"));
        handler.handleMessage(session, new TextMessage("REQ bad-2 /connect UNKNOWN"));
        handler.handleMessage(session, new TextMessage("REQ bad-3"));
        handler.handleMessage(session, new TextMessage("MEAS:VOLT?"));

        assertThat(session.textMessages()).containsExactly(
                "RES bad-1 ERR BAD_DEVICE_ADD_SYNTAX Use: /device-add name,type,ip,port,baudrate",
                "RES bad-2 ERR DEVICE_NOT_FOUND Device not found: UNKNOWN",
                "RES bad-3 ERR EMPTY_MESSAGE Use: REQ <uuid> <payload>",
                "ERR BAD_REQUEST_ENVELOPE Use: REQ <uuid> <payload>");
    }

    private Map<String, ScpiWebSocketCommand> commandMap(ScpiBridgeService service) {
        return new ScpiWebSocketCommandConfig().scpiWebSocketCommandMap(List.of(
                new DeviceAddCommand(service),
                new DeviceListCommand(service),
                new DeviceModifyCommand(service),
                new DeviceDeleteCommand(service),
                new ConnectCommand(service),
                new DisconnectCommand(service),
                new StatusCommand(service),
                new ExplicitScpiCommand(service)));
    }

    @NullMarked
    private static final class TestSession implements WebSocketSession {
        private final String id;
        private final List<String> textMessages = new ArrayList<>();
        private final Map<String, Object> attributes = new HashMap<>();
        private boolean open = true;

        private TestSession(String id) {
            this.id = id;
        }

        List<String> textMessages() {
            return textMessages;
        }

        @Override
        public String getId() {
            return id;
        }

        @Override
        public URI getUri() {
            return URI.create("ws://localhost/ws/scpi");
        }

        @Override
        public HttpHeaders getHandshakeHeaders() {
            return HttpHeaders.EMPTY;
        }

        @Override
        public Map<String, Object> getAttributes() {
            return attributes;
        }

        @Override
        @Nullable
        public Principal getPrincipal() {
            return null;
        }

        @Override
        @Nullable
        public InetSocketAddress getLocalAddress() {
            return null;
        }

        @Override
        @Nullable
        public InetSocketAddress getRemoteAddress() {
            return null;
        }

        @Override
        @Nullable
        public String getAcceptedProtocol() {
            return null;
        }

        @Override
        public void setTextMessageSizeLimit(int messageSizeLimit) {
        }

        @Override
        public int getTextMessageSizeLimit() {
            return 8192;
        }

        @Override
        public void setBinaryMessageSizeLimit(int messageSizeLimit) {
        }

        @Override
        public int getBinaryMessageSizeLimit() {
            return 8192;
        }

        @Override
        public List<WebSocketExtension> getExtensions() {
            return List.of();
        }

        @Override
        public void sendMessage(WebSocketMessage<?> message) {
            textMessages.add(String.valueOf(message.getPayload()));
        }

        @Override
        public boolean isOpen() {
            return open;
        }

        @Override
        public void close() {
            open = false;
        }

        @Override
        public void close(CloseStatus status) {
            open = false;
        }
    }
}
