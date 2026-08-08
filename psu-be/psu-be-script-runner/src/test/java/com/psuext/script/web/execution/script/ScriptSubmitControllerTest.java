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

import java.time.Duration;

import com.psuext.script.web.execution.script.support.ScriptControllerTestSupport;
import com.psuext.script.web.execution.model.ScriptSubmitRequest;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

class ScriptSubmitControllerTest extends ScriptControllerTestSupport {

    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry registry) {
        registerStorage(registry, "script-submit-controller");
    }

    @Test
    void acceptsScriptTask() {
        String taskId = submit("submit-script", "return 42;");

        assertThat(taskId).isNotBlank();
        assertThat(awaitResult(taskId)).contains("\"returnValue\":42", "\"finalStatus\":\"COMPLETED\"");
    }

    @Test
    void rejectsBlankScriptSource() {
        assertInvalidRequest(
                new ScriptSubmitRequest("blank-source", " ", SCRIPT_TIMEOUT),
                "source must not be blank");
    }

    @Test
    void rejectsNonPositiveTimeout() {
        assertInvalidRequest(
                new ScriptSubmitRequest("zero-timeout", "return 1;", Duration.ZERO),
                "timeout must be positive");
    }

    private void assertInvalidRequest(ScriptSubmitRequest request, String message) {
        restClient.post().uri("/api/scripts")
                .body(request)
                .exchange().expectStatus().isBadRequest()
                .expectBody(String.class).value(body -> assertThat(body)
                        .contains("\"code\":\"INVALID_REQUEST\"")
                        .contains("\"message\":\"" + message + "\""));
    }
}
