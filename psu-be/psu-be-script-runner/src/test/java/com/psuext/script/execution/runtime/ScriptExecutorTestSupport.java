package com.psuext.script.execution.runtime;

/*-
 * #%L
 * PSU-BE Script Runner
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
import java.time.Instant;
import java.time.Duration;
import java.util.function.Consumer;

import com.psuext.connection.ConnectionAutoConfiguration;
import com.psuext.connection.device.DeviceConnection;
import com.psuext.connection.device.DeviceConnectionType;
import com.psuext.connection.service.ConnectionManagementService;
import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.result.InMemoryScriptLiveEventPublisher;
import com.psuext.script.execution.result.ScriptResultEventCaptureService;
import com.psuext.script.execution.result.ScriptSeriesRecordExtractor;
import com.psuext.script.execution.result.ScriptTaskResultAssembler;
import com.psuext.script.execution.scpi.ConnectionManagementScriptScpiGateway;
import com.psuext.script.execution.scpi.ScriptDeviceSessionCoordinator;
import com.psuext.script.execution.test.SystemOutScriptTaskLogWriter;
import com.psuext.test.scpi.FakeScpiTcpServer;
import com.psuext.transport.TransportAutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

/**
 * Builds the simulator-backed service graph used by executor tests.
 */
final class ScriptExecutorTestSupport {

    private static final String DEVICE = "PSU1";
    private static final Instant CREATED_AT = Instant.parse("2026-07-20T12:00:00Z");

    private ScriptExecutorTestSupport() {
    }

    static void runWithSimulator(
            FakeScpiTcpServer server,
            Path temporaryDirectory,
            Consumer<Fixture> scenario
    ) {
        runWithSimulator(server, temporaryDirectory, () -> false, scenario);
    }

    static void runWithSimulator(
            FakeScpiTcpServer server,
            Path temporaryDirectory,
            ScriptCancellationChecker cancellationChecker,
            Consumer<Fixture> scenario
    ) {
        contextRunner(server, temporaryDirectory).run(context -> {
                    ConnectionManagementService connectionService =
                            context.getBean(ConnectionManagementService.class);
                    ScriptDeviceSessionCoordinator coordinator = new ScriptDeviceSessionCoordinator(connectionService);
                    connectSimulator(connectionService, coordinator, server);
                    scenario.accept(createFixture(server, coordinator, cancellationChecker));
                });
    }

    private static ApplicationContextRunner contextRunner(
            FakeScpiTcpServer server,
            Path temporaryDirectory
    ) {
        return new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(
                        TransportAutoConfiguration.class,
                        ConnectionAutoConfiguration.class)
                )
                .withPropertyValues(
                        "psu.connection.devices.file=" + temporaryDirectory.resolve("devices.json"),
                        "psu.transport.tcp.host=127.0.0.1",
                        "psu.transport.tcp.port=" + server.port(),
                        "psu.transport.tcp.connect-timeout=1s",
                        "psu.transport.tcp.read-timeout=200ms",
                        "psu.transport.tcp.command-timeout=200ms",
                        "psu.transport.tcp.timeout-disconnect-threshold=3"
                );
    }

    private static void connectSimulator(
            ConnectionManagementService connectionService,
            ScriptDeviceSessionCoordinator coordinator,
            FakeScpiTcpServer server
    ) {
        connectionService.addDevice(new DeviceConnection(
                -1,
                DEVICE,
                DeviceConnectionType.TCP,
                "127.0.0.1",
                String.valueOf(server.port()),
                null));
        coordinator.connect(DEVICE);
    }

    private static Fixture createFixture(
            FakeScpiTcpServer server,
            ScriptDeviceSessionCoordinator coordinator,
            ScriptCancellationChecker cancellationChecker
    ) {
        ScriptTaskId taskId = ScriptTaskId.random();
        ScriptTaskResultAssembler assembler = new ScriptTaskResultAssembler(
                taskId, "test", CREATED_AT);

        ScriptResultEventCaptureService capture = new ScriptResultEventCaptureService(
                assembler,
                new SystemOutScriptTaskLogWriter(),
                taskId,
                new InMemoryScriptLiveEventPublisher(Runnable::run),
                new ScriptSeriesRecordExtractor()
        );

        ScriptBindings bindings = new ScriptBindings(
                new ConnectionManagementScriptScpiGateway(coordinator),
                capture,
                cancellationChecker,
                new ScriptScalarResponseParser(),
                Duration.ofSeconds(1),
                ignored -> { }
        );

        ScriptExecutor executor = new ScriptExecutor(
                new RestrictedGraalJsContextFactory(),
                bindings
        );

        return new Fixture(server, executor, assembler);
    }

    record Fixture(
            FakeScpiTcpServer server,
            ScriptExecutor executor,
            ScriptTaskResultAssembler assembler) {
    }
}
