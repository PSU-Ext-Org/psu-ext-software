package com.psuext.script.execution.config;

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
import java.util.function.Supplier;

import com.psuext.script.execution.model.ScriptTaskResult;
import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.model.ScriptTaskState;
import com.psuext.script.execution.model.ScriptResultEventLevel;
import com.psuext.script.execution.result.InMemoryScriptLiveEventPublisher;
import com.psuext.script.execution.result.ScriptLiveEventPublisher;
import com.psuext.script.execution.result.ScriptResultEventCaptureService;
import com.psuext.script.execution.result.ScriptTaskResultAssembler;
import com.psuext.script.execution.test.SystemOutScriptTaskLogWriter;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class ScriptResultCaptureConfigurationTest {

    private static final Instant EVENT_AT = Instant.parse("2026-07-19T12:00:01Z");
    private static final Instant ENDED_AT = Instant.parse("2026-07-19T12:00:02Z");

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withBean(ScriptLiveEventPublisher.class, () -> new InMemoryScriptLiveEventPublisher(Runnable::run))
            .withUserConfiguration(ScriptResultCaptureConfiguration.class);

    @Test
    void supplierCreatesIndependentPrototypeAssemblers() {
        contextRunner.run(context -> {
            @SuppressWarnings("unchecked")
            Supplier<ScriptTaskResultAssembler> assemblerSupplier = context.getBean(
                    "scriptTaskResultAssemblerSupplier", Supplier.class);

            ScriptTaskResultAssembler firstAssembler = assemblerSupplier.get();
            ScriptTaskResultAssembler secondAssembler = assemblerSupplier.get();

            assertThat(firstAssembler).isNotSameAs(secondAssembler);

            ScriptResultEventCaptureService firstCapture = context.getBean(
                    ScriptResultEventCaptureService.class,
                    firstAssembler,
                    new SystemOutScriptTaskLogWriter(),
                    ScriptTaskId.random(),
                    context.getBean(ScriptLiveEventPublisher.class));

            ScriptResultEventCaptureService secondCapture = context.getBean(
                    ScriptResultEventCaptureService.class,
                    secondAssembler,
                    new SystemOutScriptTaskLogWriter(),
                    ScriptTaskId.random(),
                    context.getBean(ScriptLiveEventPublisher.class));

            assertThat(firstCapture).isNotSameAs(secondCapture);
            firstCapture.captureLog(EVENT_AT, ScriptResultEventLevel.INFO, "first log");
            secondCapture.captureLog(EVENT_AT, ScriptResultEventLevel.INFO, "second log");

            ScriptTaskResult firstResult = firstAssembler
                    .complete(ScriptTaskState.COMPLETED, null, null, null, ENDED_AT);
            ScriptTaskResult secondResult = secondAssembler
                    .complete(ScriptTaskState.COMPLETED, null, null, null, ENDED_AT);

            assertThat(firstResult).isNotNull();
            assertThat(firstResult.finalStatus()).isEqualTo(ScriptTaskState.COMPLETED);
            assertThat(firstResult.series()).isEmpty();
            assertThat(secondResult).isNotNull();
            assertThat(secondResult.finalStatus()).isEqualTo(ScriptTaskState.COMPLETED);
            assertThat(secondResult.series()).isEmpty();
        });
    }

}
