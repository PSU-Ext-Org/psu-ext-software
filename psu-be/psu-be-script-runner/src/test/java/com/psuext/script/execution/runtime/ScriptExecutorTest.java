package com.psuext.script.execution.runtime;

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
import java.time.Instant;
import java.util.Base64;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.psuext.script.execution.model.ScriptTaskResult;
import com.psuext.script.execution.model.ScriptTaskState;
import com.psuext.script.execution.storage.file.FileScriptResultStore;
import com.psuext.test.scpi.FakeScpiTcpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ScriptExecutorTest {

    private static final Instant ENDED_AT = Instant.parse("2026-07-20T12:00:02Z");

    @TempDir
    private Path temporaryDirectory;

    @Test
    void executesBindingsAndAssemblesTypedResult() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start().respondTo("MEAS:VOLT?", "12.34")) {
            ScriptExecutorTestSupport.runWithSimulator(server, temporaryDirectory, fixture -> {

                ScriptExecutionResult execution = fixture.executor().execute("""
                        (() => {
                          var reading = query('PSU1', 'MEAS:VOLT?');
                          write('PSU1', 'OUTP ON');
                          log('WARN', 'limit reached');
                          record(new Date(), 'voltage', 'V', reading);
                          return {reading: reading, enabled: true};
                        })();
                        """);

                assertThat(execution.succeeded()).isTrue();
                assertThat(execution.returnValue()).isEqualTo(Map.of("reading", 12.34d, "enabled", true));
                assertThat(server.commands()).containsExactly("MEAS:VOLT?", "OUTP ON");

                ScriptTaskResult result = fixture.assembler().complete(
                        ScriptTaskState.COMPLETED,
                        execution.returnValue(),
                        execution.error(),
                        ENDED_AT);

                assertThat(result.series()).singleElement().satisfies(series -> {
                    assertThat(series.name()).isEqualTo("voltage");
                    assertThat(series.points()).hasSize(1);
                });
                FileScriptResultStore resultStore = new FileScriptResultStore(temporaryDirectory, new ObjectMapper());
                resultStore.save(result);
                assertThat(resultStore.findById(result.taskId()))
                        .hasValueSatisfying(stored -> assertThat(stored.returnValue())
                                .isEqualTo(Map.of("reading", 12.34d, "enabled", true)));
            });
        }
    }

    @Test
    void convertsScriptFailureToTaskError() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start()) {
            ScriptExecutorTestSupport.runWithSimulator(server, temporaryDirectory, fixture -> {
                ScriptExecutionResult execution = fixture.executor().execute("(() => { throw new Error('broken'); })();");

                assertThat(execution.succeeded()).isFalse();
                assertThat(execution.error().source()).isEqualTo("SCRIPT");
            });
        }
    }

    @Test
    void queryBinaryReturnsBase64EncodedCompleteBlock() throws Exception {
        byte[] block = new byte[] {'#', '1', '2', 0x01, 0x02};
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start().respondBinaryTo("DATA?", block)) {
            ScriptExecutorTestSupport.runWithSimulator(server, temporaryDirectory, fixture -> {
                ScriptExecutionResult execution = fixture.executor().execute("(() => { return queryBinary('PSU1', 'DATA?'); })();");

                assertThat(execution.succeeded()).isTrue();
                assertThat(execution.returnValue()).isEqualTo(Base64.getEncoder().encodeToString(block));
            });
        }
    }

    @Test
    void rejectsSleepPastConfiguredMaximum() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start()) {
            ScriptExecutorTestSupport.runWithSimulator(server, temporaryDirectory, fixture -> {
                ScriptExecutionResult execution = fixture.executor().execute("(() => { sleep(1001); })();");

                assertThat(execution.succeeded()).isFalse();
                assertThat(execution.error().message()).contains("sleep duration exceeds maximum");
            });
        }
    }

    @Test
    void cancelledReflectsTaskCancellationStateWithoutThrowing() throws Exception {
        try (FakeScpiTcpServer server = FakeScpiTcpServer.start()) {
            ScriptExecutorTestSupport.runWithSimulator(server, temporaryDirectory, () -> true, fixture -> {
                ScriptExecutionResult execution = fixture.executor().execute("(() => { return cancelled(); })();");

                assertThat(execution.succeeded()).isTrue();
                assertThat(execution.returnValue()).isEqualTo(true);
            });
        }
    }
}
