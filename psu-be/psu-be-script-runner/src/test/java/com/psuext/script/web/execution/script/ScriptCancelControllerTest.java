package com.psuext.script.web.execution.script;

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

import com.psuext.script.web.execution.script.support.ScriptControllerTestSupport;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

class ScriptCancelControllerTest extends ScriptControllerTestSupport {

    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry registry) {
        registerStorage(registry, "script-cancel-controller");
    }

    @Test
    void cancelsRunningTask() {
        String taskId = submit("cancel-running", """
                const wakeAt = Date.now() + 2_000;
                while (Date.now() < wakeAt) {
                }
                return 'too late';
                """);

        awaitState(taskId, "RUNNING");

        restClient.post().uri("/api/scripts/{taskId}/cancel", taskId)
                .exchange().expectStatus().isAccepted()
                .expectBody(String.class).value(body -> assertThat(body)
                        .contains("\"taskId\":\"" + taskId + "\"")
                        .contains("\"accepted\":true")
                        .contains("\"state\":\"CANCELLING\""));

        awaitState(taskId, "CANCELLED");
        awaitStoredResult(taskId);
        assertThat(get("/api/scripts/" + taskId + "/result"))
                .contains("\"finalStatus\":\"CANCELLED\"")
                .contains("\"code\":\"SCRIPT_CANCELLED\"");
    }

    @Test
    void reportsCompletedTaskCannotBeCancelled() {
        String taskId = submitAndAwaitCompleted("cancelled-completed", "return 1;");

        restClient.post().uri("/api/scripts/{taskId}/cancel", taskId)
                .exchange().expectStatus().isAccepted()
                .expectBody(String.class).value(body -> assertThat(body)
                        .contains("\"taskId\":\"" + taskId + "\"")
                        .contains("\"accepted\":false")
                        .contains("\"state\":\"COMPLETED\""));
    }

    @Test
    void returnsNotFoundForUnknownTask() {
        restClient.post().uri("/api/scripts/{taskId}/cancel", unknownTaskId())
                .exchange().expectStatus().isNotFound()
                .expectBody(String.class).value(body -> assertThat(body)
                        .contains("\"code\":\"TASK_NOT_FOUND\""));
    }
}
