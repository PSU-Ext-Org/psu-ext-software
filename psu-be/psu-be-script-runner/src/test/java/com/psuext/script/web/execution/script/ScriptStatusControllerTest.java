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

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import com.psuext.script.execution.model.ScriptStartRequest;
import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.model.ScriptTaskResult;
import com.psuext.script.execution.model.ScriptTaskPage;
import com.psuext.script.execution.model.ScriptPendingInput;
import com.psuext.script.execution.model.ScriptTaskQuery;
import com.psuext.script.execution.model.ScriptTaskSnapshot;
import com.psuext.script.execution.model.ScriptTaskState;
import com.psuext.script.execution.service.ScriptRunnerService;
import com.psuext.script.web.execution.controller.ScriptTaskController;
import com.psuext.script.web.execution.util.ScriptTaskIdResolver;
import com.psuext.script.web.execution.script.support.ScriptControllerTestSupport;
import com.psuext.script.web.execution.model.ScriptTaskStatusResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

class ScriptStatusControllerTest extends ScriptControllerTestSupport {

    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry registry) {
        registerStorage(registry, "script-status-controller");
    }

    @Test
    void returnsCompletedTaskStatus() {
        String taskId = submitAndAwaitCompleted("status-script", "return 'ready';");

        assertThat(get("/api/scripts/" + taskId))
                .contains("\"taskId\":\"" + taskId + "\"")
                .contains("\"name\":\"status-script\"")
                .contains("\"state\":\"COMPLETED\"");
    }

    @ParameterizedTest
    @EnumSource(ScriptTaskState.class)
    void mapsEveryTaskStateToStatusResponse(ScriptTaskState state) {
        ScriptTaskId taskId = ScriptTaskId.random();
        ScriptTaskSnapshot snapshot = snapshot(taskId, state);
        ScriptTaskController controller = new ScriptTaskController(
                new SnapshotRunner(snapshot), new ScriptTaskIdResolver());

        ScriptTaskStatusResponse response = controller.status(taskId.toString());

        assertThat(response.state()).isEqualTo(state);
    }

    @Test
    void returnsNotFoundForUnknownTask() {
        String taskId = unknownTaskId();

        restClient.get().uri("/api/scripts/{taskId}", taskId)
                .exchange().expectStatus().isNotFound()
                .expectBody(String.class).value(body -> assertThat(body)
                        .contains("\"code\":\"TASK_NOT_FOUND\""));
    }

    private static ScriptTaskSnapshot snapshot(ScriptTaskId taskId, ScriptTaskState state) {
        Instant now = Instant.now();
        ScriptPendingInput pendingInput = state == ScriptTaskState.PENDING_INPUT
                ? new ScriptPendingInput("status-input", "Enter a value", now.plusSeconds(60))
                : null;
        return new ScriptTaskSnapshot(
                taskId,
                "status-state-" + state.name().toLowerCase(),
                now,
                state == ScriptTaskState.QUEUED ? null : now,
                state.isTerminal() ? now : null,
                state,
                null,
                null,
                pendingInput);
    }

    /** Script runner exposing one predefined task snapshot for status-controller tests. */
    private record SnapshotRunner(ScriptTaskSnapshot snapshot) implements ScriptRunnerService {

        @Override
        public ScriptTaskId start(ScriptStartRequest request) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Optional<ScriptTaskSnapshot> getTask(ScriptTaskId taskId) {
            return snapshot.taskId().equals(taskId) ? Optional.of(snapshot) : Optional.empty();
        }

        @Override
        public Optional<ScriptTaskResult> getResult(ScriptTaskId taskId) {
            return Optional.empty();
        }

        @Override
        public ScriptTaskPage listTasks(ScriptTaskQuery query) {
            return new ScriptTaskPage(List.of(), query.limit(), query.offset(), 0);
        }

        @Override
        public boolean cancel(ScriptTaskId taskId) {
            return false;
        }
    }
}
