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

import com.fasterxml.jackson.databind.ObjectMapper;
import com.psuext.script.execution.storage.ScriptResultStore;
import com.psuext.script.execution.storage.ScriptTaskLogReadService;
import com.psuext.script.execution.storage.ScriptTaskLogStore;
import com.psuext.script.execution.storage.ScriptTaskStore;
import com.psuext.script.execution.storage.file.FileScriptResultStore;
import com.psuext.script.execution.storage.file.FileScriptTaskLogStore;
import com.psuext.script.execution.storage.file.FileScriptTaskStore;
import com.psuext.script.execution.storage.retention.RecentScriptRetentionPolicy;
import com.psuext.script.execution.storage.retention.ScriptRetentionPolicy;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Spring configuration for script result and task-log storage.
 */
@Configuration
@EnableConfigurationProperties(ScriptStorageProperties.class)
public class ScriptStorageConfiguration {

    /**
     * Creates the configured result store.
     *
     * @param properties script storage settings
     * @param objectMapper JSON mapper for durable result files
     * @return configured result store
     */
    @Bean
    @ConditionalOnMissingBean
    ScriptResultStore scriptResultStore(ScriptStorageProperties properties, ObjectMapper objectMapper) {
        return new FileScriptResultStore(properties.getDirectory(), objectMapper);
    }

    /**
     * Creates the configured task-log store.
     *
     * @param properties script storage settings
     * @return configured task-log store
     */
    @Bean
    @ConditionalOnMissingBean
    ScriptTaskLogStore scriptTaskLogStore(ScriptStorageProperties properties) {
        return new FileScriptTaskLogStore(properties.getDirectory());
    }

    /** Creates the streaming task-log read service. */
    @Bean
    @ConditionalOnMissingBean
    ScriptTaskLogReadService scriptTaskLogReadService(ScriptTaskLogStore logStore) {
        return new ScriptTaskLogReadService(logStore);
    }

    /** Creates the durable all-status task catalogue. */
    @Bean
    @ConditionalOnMissingBean
    ScriptTaskStore scriptTaskStore(ScriptStorageProperties properties, ObjectMapper objectMapper) {
        return new FileScriptTaskStore(properties.getDirectory(), objectMapper);
    }

    /**
     * Creates the default bounded result retention policy.
     *
     * @return policy retaining the 50 most recent results
     */
    @Bean
    @ConditionalOnMissingBean
    ScriptRetentionPolicy scriptRetentionPolicy() {
        return new RecentScriptRetentionPolicy();
    }

}
