package com.psuext.script.execution.result;

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
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import com.psuext.script.execution.model.ScriptTaskError;
import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.model.ScriptTaskResult;
import com.psuext.script.execution.model.ScriptTaskState;
import org.junit.jupiter.api.Test;

class ScriptTaskResultAssemblerTest {

    private static final ScriptTaskId TASK_ID =
            new ScriptTaskId(UUID.fromString("dfbf15ea-7666-41aa-bd0d-95c6e32cd08a"));
    private static final Instant CREATED_AT = Instant.parse("2026-07-19T12:00:00Z");
    private static final Instant STARTED_AT = Instant.parse("2026-07-19T12:00:01Z");
    private static final Instant ENDED_AT = Instant.parse("2026-07-19T12:00:02Z");

    @Test
    void assemblesTerminalResultExactlyOnce() {
        ScriptTaskResultAssembler assembler = assembler();
        assembler.started(STARTED_AT);
        assembler.appendSeriesPoint("voltage", "V", STARTED_AT, 12.34);

        ScriptTaskResult result = assembler.complete(
                ScriptTaskState.COMPLETED,
                1.0,
                Map.of("ok", true),
                null,
                ENDED_AT);

        assertThat(result.taskId()).isEqualTo(TASK_ID);
        assertThat(result.name()).isEqualTo("test");
        assertThat(result.createdAt()).isEqualTo(CREATED_AT);
        assertThat(result.startedAt()).isEqualTo(STARTED_AT);
        assertThat(result.endedAt()).isEqualTo(ENDED_AT);
        assertThat(result.finalStatus()).isEqualTo(ScriptTaskState.COMPLETED);
        assertThat(result.finalProgress()).isEqualTo(1.0);
        assertThat(result.returnValue()).isEqualTo(Map.of("ok", true));
        assertThat(result.series()).singleElement().satisfies(series -> {
            assertThat(series.name()).isEqualTo("voltage");
            assertThat(series.points()).hasSize(1);
        });

        assertThatExceptionOfType(IllegalStateException.class)
                .isThrownBy(() -> assembler.complete(ScriptTaskState.COMPLETED, null, null, null, ENDED_AT));
    }

    @Test
    void allowsFailureBeforeStartedAtIsKnown() {
        ScriptTaskResult result = assembler().complete(
                ScriptTaskState.FAILED,
                null,
                null,
                new ScriptTaskError("SCRIPT_ERROR", "Script did not start", "SCRIPT", null),
                ENDED_AT);

        assertThat(result.startedAt()).isNull();
        assertThat(result.finalStatus()).isEqualTo(ScriptTaskState.FAILED);
    }

    private static ScriptTaskResultAssembler assembler() {
        return new ScriptTaskResultAssembler(TASK_ID, "test", CREATED_AT);
    }
}
