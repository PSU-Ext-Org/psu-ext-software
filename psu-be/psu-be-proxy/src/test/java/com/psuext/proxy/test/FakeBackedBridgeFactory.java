package com.psuext.proxy.test;

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

import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.psuext.connection.data.BinaryDataFrameParser;
import com.psuext.connection.device.DeviceConnectionDao;
import com.psuext.connection.device.JsonDeviceConnectionDao;
import com.psuext.connection.service.ConnectionManagementService;
import com.psuext.connection.service.DeviceConnectionManager;
import com.psuext.proxy.scpi.ScpiBridgeService;
import com.psuext.transport.config.TransportProperties;
import com.psuext.transport.core.ScpiTransport;
import com.psuext.transport.core.ScpiTransportFactory;
import com.psuext.transport.tcp.ScpiTcpResponseHandler;

/**
 * Reusable test fixture for bridge services backed by fake SCPI transports.
 */
public final class FakeBackedBridgeFactory {

    private FakeBackedBridgeFactory() {
    }

    /**
     * Creates a bridge service whose TCP devices use the standard fixed-response
     * fake transport.
     *
     * @param registryFile JSON registry file for the test
     * @return fake-backed bridge service
     */
    public static ScpiBridgeService fixedResponseBridge(Path registryFile) {
        return bridge(registryFile, FakeMode.fixed());
    }

    /**
     * Creates a bridge service whose TCP devices echo commands with a prefix.
     *
     * @param registryFile JSON registry file for the test
     * @param prefix response prefix
     * @return fake-backed bridge service
     */
    public static ScpiBridgeService echoingBridge(Path registryFile, String prefix) {
        return bridge(registryFile, FakeMode.echoing(prefix));
    }

    /**
     * Creates a bridge service whose TCP devices return a fixed binary SCPI
     * block.
     *
     * @param registryFile JSON registry file for the test
     * @param response complete SCPI binary block
     * @return fake-backed bridge service
     */
    public static ScpiBridgeService binaryBridge(Path registryFile, byte[] response) {
        return bridge(registryFile, FakeMode.binary(response));
    }

    private static ScpiBridgeService bridge(Path registryFile, FakeMode fakeMode) {
        ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
        DeviceConnectionDao dao = new JsonDeviceConnectionDao(objectMapper, registryFile);
        ScpiTransportFactory factory = new ScpiTransportFactory(
                new TransportProperties(),
                event -> {
                },
                new ScpiTcpResponseHandler(Map.of())) {
            @Override
            public ScpiTransport create(String transportType) {
                return fakeMode.create();
            }
        };
        ConnectionManagementService service = new ConnectionManagementService(
                dao,
                new DeviceConnectionManager(dao, factory),
                List.of(new BinaryDataFrameParser()));
        return new ScpiBridgeService(service);
    }

    private record FakeMode(String echoPrefix, byte[] binaryResponse) {

        private FakeMode {
            binaryResponse = binaryResponse == null ? null : Arrays.copyOf(binaryResponse, binaryResponse.length);
        }

        static FakeMode fixed() {
            return new FakeMode(null, null);
        }

        static FakeMode echoing(String prefix) {
            return new FakeMode(prefix, null);
        }

        static FakeMode binary(byte[] response) {
            return new FakeMode(null, response);
        }

        ScpiTransport create() {
            if (echoPrefix != null) {
                return ProxyTestScpiTransport.echoing(echoPrefix);
            }
            if (binaryResponse != null) {
                return ProxyTestScpiTransport.respondingWithBinary(binaryResponse);
            }
            return new ProxyTestScpiTransport();
        }
    }
}
