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

import java.time.Instant;
import java.util.function.Supplier;

import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.result.ScriptResultEventCaptureService;
import com.psuext.script.execution.result.ScriptResultEventSink;
import com.psuext.script.execution.result.ScriptSeriesRecordExtractor;
import com.psuext.script.execution.result.ScriptTaskResultAssembler;
import com.psuext.script.execution.result.ScriptLiveEventPublisher;
import com.psuext.script.execution.storage.ScriptTaskLogWriter;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Scope;

/**
 * Spring configuration for task-local script result capture components.
 */
@Configuration
public class ScriptResultCaptureConfiguration {

    private final Supplier<ScriptSeriesRecordExtractor> seriesRecordExtractorSupplier;

    /**
     * Creates result capture configuration.
     *
     * @param extractorProvider prototype extractor provider
     */
    public ScriptResultCaptureConfiguration(
            ObjectProvider<ScriptSeriesRecordExtractor> extractorProvider
    ) {
        this.seriesRecordExtractorSupplier = extractorProvider::getObject;
    }

    /**
     * Exposes creation of a fresh result assembler prototype.
     *
     * @param assemblerProvider prototype assembler provider
     * @return result assembler supplier
     */
    @Bean
    Supplier<ScriptTaskResultAssembler> scriptTaskResultAssemblerSupplier(
            ObjectProvider<ScriptTaskResultAssembler> assemblerProvider) {
        return assemblerProvider::getObject;
    }

    /**
     * Creates one task-local result assembler prototype. Its metadata suppliers
     * are resolved by Spring and evaluated for every prototype instance.
     *
     * @param taskIdSupplier task id supplier
     * @param taskNameSupplier task name supplier
     * @param createdAtSupplier creation time supplier
     * @return task-local result assembler
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    ScriptTaskResultAssembler scriptTaskResultAssembler(
            @Qualifier("scriptTaskIdSupplier") Supplier<ScriptTaskId> taskIdSupplier,
            @Qualifier("scriptTaskNameSupplier") Supplier<String> taskNameSupplier,
            @Qualifier("scriptTaskCreatedAtSupplier") Supplier<Instant> createdAtSupplier
    ) {
        return new ScriptTaskResultAssembler(
                taskIdSupplier.get(),
                taskNameSupplier.get(),
                createdAtSupplier.get());
    }

    @Bean
    @Qualifier("scriptTaskIdSupplier")
    Supplier<ScriptTaskId> scriptTaskIdSupplier() {
        return ScriptTaskId::random;
    }

    @Bean
    @Qualifier("scriptTaskNameSupplier")
    Supplier<String> scriptTaskNameSupplier() {
        return () -> "script";
    }

    @Bean
    @Qualifier("scriptTaskCreatedAtSupplier")
    Supplier<Instant> scriptTaskCreatedAtSupplier() {
        return Instant::now;
    }

    /**
     * Creates one task-local event capture service prototype.
     *
     * @param sink task result event sink
     * @param logWriter task log writer
     * @param taskId task identifier
     * @param liveEventPublisher live event publisher
     * @return task-local event capture service
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    ScriptResultEventCaptureService scriptResultEventCaptureService(
            ScriptResultEventSink sink,
            ScriptTaskLogWriter logWriter,
            ScriptTaskId taskId,
            ScriptLiveEventPublisher liveEventPublisher
    ) {
        return new ScriptResultEventCaptureService(
                sink,
                logWriter,
                taskId,
                liveEventPublisher,
                seriesRecordExtractorSupplier.get()
        );
    }

    /**
     * Creates one series extractor prototype.
     *
     * @return task-local series extractor
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    ScriptSeriesRecordExtractor scriptSeriesRecordExtractor() {
        return new ScriptSeriesRecordExtractor();
    }

    /**
     * Exposes creation of a fresh series extractor for each capture service.
     *
     * @return series extractor supplier
     */
    @Bean
    @Qualifier("scriptSeriesRecordExtractorSupplier")
    Supplier<ScriptSeriesRecordExtractor> scriptSeriesRecordExtractorSupplier() {
        return seriesRecordExtractorSupplier;
    }
}
