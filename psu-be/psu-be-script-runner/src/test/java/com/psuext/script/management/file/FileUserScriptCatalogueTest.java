package com.psuext.script.management.file;

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
import com.psuext.script.management.model.CreateScriptRequest;
import com.psuext.script.management.model.ScriptDefinition;
import com.psuext.script.management.model.ScriptDefinitionQuery;
import com.psuext.script.management.model.UpdateScriptRequest;
import com.psuext.script.test.logging.LogCapture;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.util.unit.DataSize;

class FileUserScriptCatalogueTest {

    @TempDir
    private Path temporaryDirectory;

    @Test
    void persistsAndReplacesAUserDefinition() {
        var catalogue = catalogue();
        ScriptDefinition created;
        ScriptDefinition updated;
        try (LogCapture logs = LogCapture.forClass(FileUserScriptCatalogue.class)) {
            created = catalogue.create(new CreateScriptRequest("Measure voltage",
                    wrapped("return query('PSU1', 'MEAS:VOLT?');"),
                    List.of("voltage", "measurement"))
            );

            updated = catalogue.replace(
                    created.id(), new UpdateScriptRequest("Measure current", wrapped("return 2;"),
                            List.of("current"))
            );
            assertThat(logs.messages()).anyMatch(message -> message.startsWith("User script definition created"));
            assertThat(logs.messages()).anyMatch(message -> message.startsWith("User script definition replaced"));
            assertThat(logs.messages()).noneMatch(message -> message.contains("MEAS:VOLT?"));
        }

        assertThat(updated.createdAt()).isEqualTo(created.createdAt());
        assertThat(updated.updatedAt()).isAfterOrEqualTo(created.updatedAt());
        assertThat(catalogue.find(created.id())).contains(updated);
        assertThat(temporaryDirectory.resolve(created.id().value()).resolve("definition.json")).isRegularFile();
        assertThat(temporaryDirectory.resolve(created.id().value()).resolve("source.js"))
                .hasContent(wrapped("return 2;"));
    }

    @Test
    void filtersPagesAndIgnoresIncompleteEntries() throws Exception {
        var catalogue = catalogue();
        catalogue.create(new CreateScriptRequest("Voltage sample",
                wrapped("return 1;"), List.of("voltage")));
        catalogue.create(new CreateScriptRequest("Current sample"
                , wrapped("return 2;"), List.of("current")));

        Files.createDirectories(temporaryDirectory.resolve("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"));

        var page = catalogue.list(new ScriptDefinitionQuery(10, 0, "sample", List.of("voltage")));

        assertThat(page.total()).isEqualTo(1);
        assertThat(page.items()).singleElement()
                .extracting(ScriptDefinition::name)
                .isEqualTo("Voltage sample");
    }

    @Test
    void matchesAnyRequestedTag() {
        var catalogue = catalogue();
        catalogue.create(new CreateScriptRequest("Voltage sample",
                wrapped("return 1;"), List.of("voltage")));

        var page = catalogue.list(new ScriptDefinitionQuery(10, 0, null,
                List.of("current", "voltage"))
        );

        assertThat(page.items()).singleElement().extracting(ScriptDefinition::name)
                .isEqualTo("Voltage sample");
    }

    @Test
    void deletesOnlyTheRequestedDefinition() {
        var catalogue = catalogue();
        var created = catalogue.create(new CreateScriptRequest("Voltage", wrapped("return 1;"), List.of()));

        assertThat(catalogue.delete(created.id())).isTrue();
        assertThat(catalogue.delete(created.id())).isFalse();
        assertThat(catalogue.find(created.id())).isEmpty();
    }

    @Test
    void rejectsOversizedSourceBeforePublishingFiles() {
        var catalogue = catalogue();

        assertThatThrownBy(() -> catalogue.create(new CreateScriptRequest("Large", "x".repeat(1_025),
                List.of())))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(temporaryDirectory).isEmptyDirectory();
    }

    private FileUserScriptCatalogue catalogue() {
        return new FileUserScriptCatalogue(
                temporaryDirectory, new ObjectMapper().findAndRegisterModules(), DataSize.ofKilobytes(1));
    }

    private static String wrapped(String source) {
        return "(() => { " + source + " })();";
    }
}
