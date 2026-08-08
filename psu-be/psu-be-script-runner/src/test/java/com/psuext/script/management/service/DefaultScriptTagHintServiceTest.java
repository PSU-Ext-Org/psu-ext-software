package com.psuext.script.management.service;

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

import com.psuext.script.management.model.ScriptDefinition;
import com.psuext.script.management.model.ScriptDefinitionId;
import com.psuext.script.management.model.ScriptDefinitionOrigin;
import com.psuext.script.management.support.InMemoryScriptCatalogue;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class DefaultScriptTagHintServiceTest {

    @Test
    void returnsDistinctTagsInCatalogueOrder() {
        var catalogue = new InMemoryScriptCatalogue();
        catalogue.put(definition("alpha", List.of("first", "shared")));
        catalogue.put(definition("beta", List.of("shared", "second")));

        assertThat(new DefaultScriptTagHintService(catalogue).recentTags())
                .containsExactly("first", "shared", "second");
    }

    private static ScriptDefinition definition(String id, List<String> tags) {
        return new ScriptDefinition(new ScriptDefinitionId(id), id, "(() => { return 1; })();", tags,
                ScriptDefinitionOrigin.USER, Instant.EPOCH, Instant.EPOCH);
    }
}
