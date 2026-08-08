package com.psuext.script.management.config;

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
import com.psuext.script.management.api.ScriptCatalogue;
import com.psuext.script.management.builtin.ClasspathBuiltinScriptCatalogue;
import com.psuext.script.management.file.FileUserScriptCatalogue;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.support.ResourcePatternResolver;

/**
 * Spring wiring for the separate user and builtin script-definition catalogues.
 *
 * <p>Both namespaces use the same {@link ScriptCatalogue} boundary, so consumers must inject one of the
 * named qualifiers rather than relying on type-based selection. Defaults are conditional by bean name, allowing
 * tests and deployments to replace either catalogue independently.</p>
 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(ScriptManagementProperties.class)
public class ScriptManagementConfiguration {

    /** Qualifier and bean name for the mutable user-script catalogue. */
    public static final String USER_SCRIPT_CATALOGUE = "userScriptCatalogue";

    /** Qualifier and bean name for the immutable packaged builtin-script catalogue. */
    public static final String BUILTIN_SCRIPT_CATALOGUE = "builtinScriptCatalogue";

    /**
     * Creates the configured persistent user-script catalogue when it has not been overridden.
     *
     * @param properties configured user-script persistence limits and location
     * @param objectMapper mapper used by the persistence adapter
     * @return mutable user-script catalogue
     */
    @Bean(USER_SCRIPT_CATALOGUE)
    @Qualifier(USER_SCRIPT_CATALOGUE)
    @ConditionalOnMissingBean(name = USER_SCRIPT_CATALOGUE)
    ScriptCatalogue userScriptCatalogue(ScriptManagementProperties properties, ObjectMapper objectMapper) {
        return new FileUserScriptCatalogue(
                properties.getUserDirectory(), objectMapper, properties.getMaximumSourceCodeSize());
    }

    /**
     * Loads the immutable packaged builtin-script catalogue when it has not been overridden.
     *
     * @param resourcePatternResolver resolver for packaged script resources
     * @param objectMapper mapper used for the catalogue manifest
     * @param properties configured source-code size limit
     * @return immutable builtin-script catalogue
     */
    @Bean(BUILTIN_SCRIPT_CATALOGUE)
    @Qualifier(BUILTIN_SCRIPT_CATALOGUE)
    @ConditionalOnMissingBean(name = BUILTIN_SCRIPT_CATALOGUE)
    ScriptCatalogue builtinScriptCatalogue(
            ResourcePatternResolver resourcePatternResolver,
            ObjectMapper objectMapper,
            ScriptManagementProperties properties) {
        return new ClasspathBuiltinScriptCatalogue(
                resourcePatternResolver, objectMapper, properties.getMaximumSourceCodeSize());
    }
}
