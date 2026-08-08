package com.psuext.script.execution.config;

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

import java.time.Duration;

import com.psuext.connection.service.ConnectionManagementService;
import com.psuext.script.execution.scpi.ScriptScpiGateway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = "psu.connection.devices.file=target/test-script-runner-devices.json")
class PsuBeScriptRunnerApplicationTest {

    @Autowired
    private ConnectionManagementService connectionManagementService;

    @Autowired
    private ScriptScpiGateway scriptScpiGateway;

    @Autowired
    private ScriptStorageProperties storageProperties;

    @Autowired
    private ScriptExecutionProperties executionProperties;

    @Autowired
    private ScriptRuntimeProperties runtimeProperties;

    @Autowired
    private ScriptExecutorProperties executorProperties;

    @Test
    void contextStartsWithConnectionManagementService() {
        assertThat(connectionManagementService).isNotNull();
        assertThat(scriptScpiGateway).isNotNull();
    }

    @Test
    void bindsDefaultScriptRuntimeConfiguration() {
        assertThat(storageProperties.getDirectory().getFileName()).hasToString("script-storage");
        assertThat(executionProperties.getMaximumSleep()).isEqualTo(Duration.ofMinutes(5));
        assertThat(runtimeProperties.getMaximumCompletedTasks()).isEqualTo(500);
        assertThat(runtimeProperties.getCompletedTaskRetention()).isEqualTo(Duration.ofHours(1));
        assertThat(executorProperties.getExecutionPoolSize()).isEqualTo(4);
        assertThat(executorProperties.getExecutionQueueCapacity()).isEqualTo(100);
        assertThat(executorProperties.getEventDeliveryPoolSize()).isEqualTo(2);
        assertThat(executorProperties.getEventDeliveryQueueCapacity()).isEqualTo(100);
    }
}
