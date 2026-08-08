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

/** Running-server coverage for the {@code progress(...)} script binding. */
class ScriptProgressBindingsControllerTest extends ScriptControllerTestSupport {

    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry registry) {
        registerStorage(registry, "script-progress-bindings-controller");
    }

    @Test
    void updatesSnapshotAndPublishesProgressEvent() {
        String taskId = submit("progress", "progress(0.25); sleep(250); return 'done';");

        awaitState(taskId, "RUNNING");
        assertThat(get("/api/scripts/" + taskId)).contains("\"progress\":0.25");
        awaitCompleted(taskId);
        assertThat(get("/api/scripts/" + taskId + "/events?afterSequence=0"))
                .contains("event:PROGRESS")
                .contains("\"progress\":0.25");
    }

    @Test
    void rejectsProgressOutsideTheAllowedRange() {
        String taskId = submit("progress-out-of-range", "progress(1.01);");

        awaitState(taskId, "FAILED");
        assertThat(get("/api/scripts/" + taskId + "/result"))
                .contains("progress value must be between 0.0 and 1.0");
    }
}
