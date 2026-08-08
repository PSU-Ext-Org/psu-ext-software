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

/** Running-server coverage for the {@code cancelled()} script binding. */
class ScriptCancelledBindingsControllerTest extends ScriptControllerTestSupport {

    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry registry) {
        registerStorage(registry, "script-cancelled-bindings-controller");
    }

    @Test
    void returnsFalseForTaskWithoutCancellationRequest() {
        String taskId = submitAndAwaitCompleted("cancelled-false", "return cancelled();");

        assertThat(get("/api/scripts/" + taskId + "/result"))
                .contains("\"returnValue\":false");
    }

    @Test
    void rejectsUnexpectedArguments() {
        String taskId = submit("cancelled-arguments", "cancelled('unexpected');");

        awaitState(taskId, "FAILED");
        assertThat(get("/api/scripts/" + taskId + "/result"))
                .contains("cancelled expects 0 argument(s)");
    }
}
