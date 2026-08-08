package com.psuext.script.web.execution.script.support;

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

import java.nio.file.Path;
import java.time.Duration;
import java.util.UUID;

import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.service.ScriptRunnerService;
import com.psuext.script.web.device.support.DeviceManagerControllerTestSupport;
import com.psuext.script.web.execution.model.ScriptSubmitRequest;
import org.awaitility.Awaitility;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.DynamicPropertyRegistry;

/**
 * Shared HTTP integration-test fixture for individual script controller endpoints.
 *
 * <p>Provides request submission, terminal-result polling, and isolated file-storage configuration while the
 * parent fixture supplies the configured devices and SCPI simulator.
 */
public abstract class ScriptControllerTestSupport extends DeviceManagerControllerTestSupport {

    protected static final Duration SCRIPT_TIMEOUT = Duration.ofSeconds(5);

    @Autowired
    private ScriptRunnerService runner;

    /** Registers unique result and log directories for one controller test class. */
    protected static void registerStorage(DynamicPropertyRegistry registry, String testClassName) {
        Path storageRoot = Path.of("target", testClassName + "-" + UUID.randomUUID());
        registry.add("psu.scripts.storage.directory", storageRoot::toString);
    }

    protected String submit(String name, String source) {
        String response = restClient.post().uri("/api/scripts")
                .body(new ScriptSubmitRequest(name, wrapped(source), SCRIPT_TIMEOUT))
                .exchange().expectStatus().isAccepted()
                .expectBody(String.class).returnResult().getResponseBody();

        assertThat(response).isNotNull();
        return taskId(response);
    }

    protected String submitAndAwaitCompleted(String name, String source) {
        String taskId = submit(name, source);
        awaitCompleted(taskId);
        return taskId;
    }

    protected void awaitCompleted(String taskId) {
        awaitState(taskId, "COMPLETED");
    }

    /** Waits until the task status endpoint reports the supplied state. */
    protected void awaitState(String taskId, String state) {
        Awaitility.await().atMost(SCRIPT_TIMEOUT).untilAsserted(() ->
                assertThat(get("/api/scripts/" + taskId)).contains("\"state\":\"" + state + "\""));
    }

    protected String awaitResult(String taskId) {
        awaitCompleted(taskId);
        awaitStoredResult(taskId);
        return get("/api/scripts/" + taskId + "/result");
    }

    /** Waits until the runner has durably stored one terminal result. */
    protected void awaitStoredResult(String taskId) {
        ScriptTaskId parsed = new ScriptTaskId(UUID.fromString(taskId));
        Awaitility.await().atMost(SCRIPT_TIMEOUT).until(() -> runner.getResult(parsed).isPresent());
    }

    protected static String unknownTaskId() {
        return UUID.randomUUID().toString();
    }

    /** Wraps a test script in the same top-level function required of persisted script sources. */
    protected static String wrapped(String source) {
        return "(() => {\n" + source + "\n})();";
    }

    private static String taskId(String json) {
        String marker = "\"taskId\":\"";
        int start = json.indexOf(marker) + marker.length();
        int end = json.indexOf('"', start);
        return json.substring(start, end);
    }
}
