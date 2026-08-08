package com.psuext.script.management.model;

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
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class ScriptDefinitionModelTest {

    @Test
    void normalizesDefinitionRequestFields() {
        var request = new CreateScriptRequest("  Measure voltage  ", "(() => { return 12; })();", List.of("Voltage", "measurement"));

        assertThat(request.name()).isEqualTo("Measure voltage");
        assertThat(request.tags()).containsExactly("measurement", "voltage");
    }

    @Test
    void rejectsInvalidBoundaryValues() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> new ScriptDefinitionId("Not-safe"));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> new CreateScriptRequest("\n", "(() => { return 1; })();", List.of()));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> new CreateScriptRequest("name", "  ", List.of()));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> new CreateScriptRequest("name", "(() => { return 1; })();", List.of("tag", "TAG")));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> new CreateScriptRequest("name", "return 1;", List.of()));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> new ScriptDefinitionQuery(501, 0, null, List.of()));
    }

    @Test
    void allowsNumberedFilesystemSafeDefinitionIds() {
        assertThat(new ScriptDefinitionId("1-hello-runner").value()).isEqualTo("1-hello-runner");
    }

    @Test
    void allowsCommentsBeforeAndAfterTheRequiredSourceWrapper() {
        var source = "// Record output voltage\n(() => { return 12; })();\n/* End of script */";

        var request = new CreateScriptRequest("Measure voltage", source, List.of());

        assertThat(request.sourceCode()).isEqualTo(source);
    }

    @Test
    void keepsDefinitionCollectionsImmutable() {
        var definition = new ScriptDefinition(new ScriptDefinitionId("read-voltage"), "Read voltage",
                "(() => { return 1; })();", List.of("voltage"),
                ScriptDefinitionOrigin.USER, Instant.EPOCH, Instant.EPOCH);

        assertThat(definition.tags()).containsExactly("voltage");
        assertThatIllegalArgumentException().isThrownBy(
                () -> new ScriptDefinition(
                        definition.id(), definition.name(), definition.sourceCode(), definition.tags(),
                        definition.origin(), Instant.now(), Instant.EPOCH));
    }
}
