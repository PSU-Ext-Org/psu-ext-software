package com.psuext.script.execution.storage.retention;

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
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.model.ScriptTaskResultSummary;
import com.psuext.script.execution.model.ScriptTaskState;
import org.junit.jupiter.api.Test;

class RecentScriptRetentionPolicyTest {

    @Test
    void selectsResultsOlderThanTheNewestFifty() {
        List<ScriptTaskResultSummary> summaries = new ArrayList<>();
        for (int index = 0; index < 51; index++) {
            summaries.add(summary(index));
        }

        assertThat(new RecentScriptRetentionPolicy().taskIdsToDelete(summaries, Instant.now()))
                .containsExactly(summaries.get(0).taskId());
    }

    private static ScriptTaskResultSummary summary(int index) {
        return new ScriptTaskResultSummary(
                new ScriptTaskId(UUID.nameUUIDFromBytes(("task-" + index).getBytes())),
                "task-" + index,
                Instant.parse("2026-07-19T12:00:00Z").plusSeconds(index),
                Instant.parse("2026-07-19T12:00:01Z").plusSeconds(index),
                ScriptTaskState.COMPLETED);
    }
}
