package com.psuext.script.execution.service;

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
import java.time.Instant;

import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.model.ScriptTaskState;
import com.psuext.script.execution.runtime.ScriptExecutionResult;
import org.junit.jupiter.api.Test;

class RunningScriptTaskTest {

    @Test
    void startsOnlyOnceFromQueuedState() {
        RunningScriptTask task = task();

        assertThat(task.markRunning(Instant.now())).isTrue();
        assertThat(task.markRunning(Instant.now())).isFalse();
        assertThat(task.snapshot().state()).isEqualTo(ScriptTaskState.RUNNING);
    }

    @Test
    void cancellationProducesOneCancelledTerminalOutcome() {
        RunningScriptTask task = task();
        task.markRunning(Instant.now());

        assertThat(task.cancel()).isTrue();
        assertThat(task.snapshot().state()).isEqualTo(ScriptTaskState.CANCELLING);
        assertThat(task.finish(new ScriptExecutionResult(42, null), Instant.now()))
                .map(ScriptTaskTerminalResult::state)
                .contains(ScriptTaskState.CANCELLED);
        assertThat(task.finish(new ScriptExecutionResult(42, null), Instant.now())).isEmpty();
        assertThat(task.cancel()).isFalse();
    }

    @Test
    void timeoutIsTerminalAndRejectsLaterExecutionCompletion() {
        RunningScriptTask task = task();
        task.markRunning(Instant.now());

        assertThat(task.timeout(Instant.now())).map(ScriptTaskTerminalResult::state)
                .contains(ScriptTaskState.TIMED_OUT);
        assertThat(task.finish(new ScriptExecutionResult(42, null), Instant.now())).isEmpty();
        assertThat(task.updateProgress(0.5d)).isFalse();
    }

    private static RunningScriptTask task() {
        return new RunningScriptTask(
                ScriptTaskId.random(), "test", "return 1;", Duration.ofSeconds(1), Instant.now());
    }
}
