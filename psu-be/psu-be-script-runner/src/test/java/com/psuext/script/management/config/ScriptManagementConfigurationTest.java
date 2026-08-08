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

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.psuext.script.management.api.ScriptCatalogue;
import com.psuext.script.management.builtin.ClasspathBuiltinScriptCatalogue;
import com.psuext.script.management.file.FileUserScriptCatalogue;
import com.psuext.script.management.model.CreateScriptRequest;
import com.psuext.script.management.support.InMemoryScriptCatalogue;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class ScriptManagementConfigurationTest {

    private final InMemoryScriptCatalogue inMemoryCatalogue = new InMemoryScriptCatalogue();

    @BeforeEach
    void setUp() {
        inMemoryCatalogue.clear();
    }

    @AfterEach
    void tearDown() {
        inMemoryCatalogue.clear();
    }

    @Test
    void createsQualifiedDefaultCatalogues() {
        contextRunner().run(context -> {
            var catalogues = context.getBean(QualifiedCatalogues.class);

            assertThat(catalogues.userCatalogue()).isInstanceOf(FileUserScriptCatalogue.class);
            assertThat(catalogues.builtinCatalogue()).isInstanceOf(ClasspathBuiltinScriptCatalogue.class);
        });
    }

    @Test
    void allowsUserCatalogueReplacementWithResettableInMemoryCatalogue() {
        contextRunner()
                .withBean(ScriptManagementConfiguration.USER_SCRIPT_CATALOGUE, ScriptCatalogue.class,
                        () -> inMemoryCatalogue)
                .run(context -> {
                    var catalogue = context.getBean(
                            ScriptManagementConfiguration.USER_SCRIPT_CATALOGUE, ScriptCatalogue.class);

                    assertThat(catalogue).isSameAs(inMemoryCatalogue);
                    assertThat(catalogue.create(new CreateScriptRequest("Test", "(() => { return 1; })();",
                            List.of())).id().value()
                    )
                    .isEqualTo("test-1");
                });
    }

    @Test
    void allowsBuiltinCatalogueReplacementWithResettableInMemoryCatalogue() {
        contextRunner()
                .withBean(ScriptManagementConfiguration.BUILTIN_SCRIPT_CATALOGUE, ScriptCatalogue.class,
                        () -> inMemoryCatalogue)
                .run(context -> assertThat(context.getBean(
                                ScriptManagementConfiguration.BUILTIN_SCRIPT_CATALOGUE, ScriptCatalogue.class))
                        .isSameAs(inMemoryCatalogue));
    }

    private static ApplicationContextRunner contextRunner() {
        return new ApplicationContextRunner()
                .withBean(ObjectMapper.class, () -> new ObjectMapper().findAndRegisterModules())
                .withBean(QualifiedCatalogues.class)
                .withUserConfiguration(ScriptManagementConfiguration.class);
    }

    private record QualifiedCatalogues(
            @Qualifier(ScriptManagementConfiguration.USER_SCRIPT_CATALOGUE) ScriptCatalogue userCatalogue,
            @Qualifier(ScriptManagementConfiguration.BUILTIN_SCRIPT_CATALOGUE) ScriptCatalogue builtinCatalogue) {
    }
}
