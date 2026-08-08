package com.psuext.script.execution.it;

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

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.StringWriter;
import java.time.Duration;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.psuext.connection.device.DeviceConnection;
import com.psuext.connection.device.DeviceConnectionType;
import com.psuext.connection.service.ConnectionManagementService;
import com.psuext.script.execution.model.*;
import com.psuext.script.execution.service.ScriptRunnerService;
import com.psuext.script.execution.storage.ScriptTaskLogStore;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Opt-in real-device smoke test for the complete script runner path.
 *
 * <p>Edit the connection and script constants below for the physical device.
 * Enable with {@code -Dpsu.script.real-device.enabled=true}. It is intentionally
 * excluded from normal and CI test runs.</p>
 */
@Disabled
@SpringBootTest(properties = {
        "psu.connection.devices.file=target/real-device-test-devices.json",
        "psu.transport.usb.platform=x86_64"
})
class RealDeviceScriptRunnerIT {

    private static final DeviceConnection DEVICE = new DeviceConnection(
            0,
            "PSU1",
            DeviceConnectionType.USB,
            null,
            "COM5",
            115200);
    private static final String SCRIPT = """
            var identity = query("PSU1", "*IDN?");
            
            var measuredVoltage = query("PSU1", "MEAS:VOLT? CH1");
            
            log("INFO", "Measured voltage: " + measuredVoltage + " V");
            log("WARN", "Test WARN");
            
            record(new Date(), "voltage", "V", measuredVoltage);
            record(new Date(), "voltage", "V", measuredVoltage);
            
            var measuredCurrent = query("PSU1", "MEAS:CURR? CH1");
            record(new Date(), "Current", "A", measuredCurrent);
            record(new Date(), "Current", "A", measuredCurrent);
            
            return {identity: identity};
            """;
    private static final Duration TIMEOUT = Duration.ofMinutes(5);

    @Autowired
    private ScriptRunnerService runner;

    @Autowired
    private ConnectionManagementService connectionService;

    @Autowired
    private ScriptTaskLogStore logStore;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void runsConfiguredScriptOnRealDevice() throws Exception {
        configureDevice();
        assertThat(connectionService.connect(DEVICE.name()).ok()).isTrue();

        ScriptTaskId taskId = runner.start(new ScriptStartRequest(
                "real-device-smoke-test", SCRIPT, TIMEOUT));
        ScriptTaskResult result = awaitResult(taskId, TIMEOUT.plusSeconds(10));

        String log = readLog(taskId);
        String resultJson = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(result);
        System.out.println("=== real device task " + taskId + " log ===");
        System.out.println(log);
        System.out.println("=== real device task " + taskId + " result ===");
        System.out.println(resultJson);

        assertThat(result.finalStatus()).isEqualTo(ScriptTaskState.COMPLETED);
        assertThat(result.returnValue()).isInstanceOf(Map.class);
        Map<?, ?> returnValue = (Map<?, ?>) result.returnValue();
        assertThat(returnValue.get("identity")).isInstanceOf(String.class);
        assertThat((String) returnValue.get("identity")).isNotBlank();

        assertThat(log)
                .contains("INFO")
                .contains("Measured voltage:")
                .contains("WARN")
                .contains("Test WARN");
        assertThat(result.series()).hasSize(2);

        assertThat(result.series()).anySatisfy(series -> {
            assertThat(series.name()).isEqualTo("voltage");
            assertThat(series.unit()).isEqualTo("V");
            assertThat(series.points()).hasSize(2);
            assertThat(series.metadata()).containsEntry("sampleCount", 2);
            assertThat(series.points()).allSatisfy(point -> assertThat(point.value()).isFinite());
        });

        assertThat(result.series()).anySatisfy(series -> {
            assertThat(series.name()).isEqualTo("Current");
            assertThat(series.unit()).isEqualTo("A");
            assertThat(series.points()).hasSize(2);
            assertThat(series.metadata()).containsEntry("sampleCount", 2);
            assertThat(series.points()).allSatisfy(point -> assertThat(point.value()).isFinite());
        });
    }

    private void configureDevice() {
        connectionService.listDevices().stream()
                .filter(device -> device.name().equalsIgnoreCase(DEVICE.name()))
                .findFirst()
                .ifPresent(device -> connectionService.deleteDevice(device.name()));
        connectionService.addDevice(DEVICE);
    }

    private ScriptTaskResult awaitResult(ScriptTaskId taskId, Duration timeout) throws InterruptedException {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            var result = runner.getResult(taskId);
            if (result.isPresent()) {
                return result.orElseThrow();
            }
            Thread.sleep(100);
        }
        throw new AssertionError("Timed out waiting for real device task result: " + taskId);
    }

    private String readLog(ScriptTaskId taskId) throws IOException {
        try (var reader = logStore.openReader(taskId).orElseThrow()) {
            StringWriter output = new StringWriter();
            reader.transferTo(output);
            return output.toString();
        }
    }

}
