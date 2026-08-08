package com.psuext.script.management.builtin;

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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.psuext.script.management.api.ScriptCatalogueOperation;
import com.psuext.script.management.api.UnsupportedCatalogueOperationException;
import com.psuext.script.management.model.CreateScriptRequest;
import com.psuext.script.management.model.ScriptDefinitionId;
import com.psuext.script.management.model.ScriptDefinitionOrigin;
import com.psuext.script.management.model.ScriptDefinitionQuery;
import java.io.IOException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.ResourcePatternResolver;
import org.springframework.util.unit.DataSize;

class ClasspathBuiltinScriptCatalogueTest {

    private static final String FIXTURE_DIRECTORY = "scripts/builtin-fixture/";
    private static final String MANIFEST_LOCATION = "classpath:scripts/builtin/catalogue.json";
    private static final String SCRIPT_PATTERN = "classpath*:scripts/builtin/*.js";

    @Test
    void loadsFixtureDefinitionsInExplicitPositionOrder() {
        var catalogue = catalogue();

        assertThat(catalogue.list(new ScriptDefinitionQuery(10, 0, null, List.of())).items())
                .extracting(definition -> definition.id().value())
                .containsExactly("fixture-beta", "fixture-alpha");
        assertThat(catalogue.find(new ScriptDefinitionId("fixture-alpha")).orElseThrow().position()).isEqualTo(20);
    }

    @Test
    void filtersFixtureDefinitionsWithoutDependingOnProductionScripts() {
        var catalogue = catalogue();

        assertThat(catalogue.list(new ScriptDefinitionQuery(10, 0, null,
                List.of("current", "voltage"))).items())
                .extracting(definition -> definition.id().value())
                .containsExactly("fixture-beta", "fixture-alpha");
        assertThat(catalogue.find(new ScriptDefinitionId("not-in-fixture"))).isEmpty();
    }

    @Test
    void rejectsMutationsWithStableOperationData() {
        var catalogue = catalogue();

        assertThatThrownBy(() -> catalogue.create(
                new CreateScriptRequest("Test", "(() => { return 1; })();", List.of()))
        )
        .isInstanceOfSatisfying(
                UnsupportedCatalogueOperationException.class,
                exception ->
            {
                assertThat(exception.operation()).isEqualTo(ScriptCatalogueOperation.CREATE);
                assertThat(exception.origin()).isEqualTo(ScriptDefinitionOrigin.BUILTIN);
            }
        );
    }

    private ClasspathBuiltinScriptCatalogue catalogue() {
        return new ClasspathBuiltinScriptCatalogue(new FixtureResourcePatternResolver(), new ObjectMapper(),
                DataSize.ofKilobytes(256));
    }

    /** Exposes only test resources, so production template changes cannot affect this test. */
    private static final class FixtureResourcePatternResolver implements ResourcePatternResolver {

        @Override
        public Resource getResource(String location) {
            if (!MANIFEST_LOCATION.equals(location)) {
                throw new IllegalArgumentException("unexpected fixture resource location " + location);
            }
            return resource("catalogue.json");
        }

        @Override
        public Resource[] getResources(String location) throws IOException {
            if (!SCRIPT_PATTERN.equals(location)) {
                throw new IOException("unexpected fixture resource pattern " + location);
            }
            return new Resource[] {resource("fixture-alpha.js"), resource("fixture-beta.js")};
        }

        @Override
        public ClassLoader getClassLoader() {
            return ClasspathBuiltinScriptCatalogueTest.class.getClassLoader();
        }

        private static Resource resource(String filename) {
            return new ClassPathResource(FIXTURE_DIRECTORY + filename);
        }
    }
}
