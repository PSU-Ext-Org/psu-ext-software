package com.psuext.script.web.controller;

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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.psuext.script.management.model.CreateScriptRequest;
import com.psuext.script.management.model.ScriptDefinition;
import com.psuext.script.management.model.ScriptDefinitionId;
import com.psuext.script.management.model.ScriptDefinitionOrigin;
import com.psuext.script.management.service.DefaultScriptTagHintService;
import com.psuext.script.management.support.InMemoryScriptCatalogue;
import com.psuext.script.web.execution.handler.ScriptApiExceptionHandler;
import java.time.Instant;
import java.util.List;

import com.psuext.script.web.scripts.controller.ScriptSourceController;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class ScriptSourceControllerTest {

    private final InMemoryScriptCatalogue builtinCatalogue =
            new InMemoryScriptCatalogue(ScriptDefinitionOrigin.BUILTIN);

    private final InMemoryScriptCatalogue userCatalogue = new InMemoryScriptCatalogue();

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        builtinCatalogue.clear();
        userCatalogue.clear();

        builtinCatalogue.put(definition(
                "read-voltage", "Read voltage", "return 1;",
                List.of("voltage"), ScriptDefinitionOrigin.BUILTIN)
        );
        builtinCatalogue.put(definition(
                "read-current", "Read current", "return 2;",
                List.of("current"), ScriptDefinitionOrigin.BUILTIN)
        );
        builtinCatalogue.put(definition(
                "disable-output", "Disable output", "return write('PSU1', 'OUTP OFF');",
                List.of("output"), ScriptDefinitionOrigin.BUILTIN)
        );

        userCatalogue.put(definition(
                "startup-check", "Startup check", "return query('PSU1', '*IDN?');",
                List.of("startup", "identity"), ScriptDefinitionOrigin.USER)
        );
        userCatalogue.put(definition(
                "current-sweep", "Current sweep", "return 0.5;",
                List.of("current", "measurement"), ScriptDefinitionOrigin.USER)
        );
        userCatalogue.put(definition(
                "diagnostic-log", "Diagnostic log", "return log('diagnostic');",
                List.of("diagnostic"), ScriptDefinitionOrigin.USER)
        );

        mockMvc = MockMvcBuilders.standaloneSetup(new ScriptSourceController(
                        builtinCatalogue, userCatalogue, new DefaultScriptTagHintService(userCatalogue)))
                .setControllerAdvice(new ScriptApiExceptionHandler())
                .build();
    }

    @AfterEach
    void tearDown() {
        builtinCatalogue.clear();
        userCatalogue.clear();
    }

    @Test
    void listBuiltinFiltersByNameAndTagWithoutReturningSourceCode() throws Exception {
        mockMvc.perform(get("/api/scripts/source/builtin")
                .param("name", "voltage").param("tag", "voltage"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.limit").value(100))
                .andExpect(jsonPath("$.offset").value(0))
                .andExpect(jsonPath("$.items[0].sourceCode").doesNotExist())
                .andExpect(jsonPath("$.items[0].origin").value("BUILTIN"));
    }

    @Test
    void listBuiltinRejectsInvalidPaging() throws Exception {
        mockMvc.perform(get("/api/scripts/source/builtin").param("limit", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void getBuiltinReturnsCompleteDefinition() throws Exception {
        mockMvc.perform(get("/api/scripts/source/builtin/read-voltage"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sourceCode").value(wrapped("return 1;")))
                .andExpect(jsonPath("$.tags[0]").value("voltage"));
    }

    @Test
    void getBuiltinReportsMissingDefinition() throws Exception {
        mockMvc.perform(get("/api/scripts/source/builtin/missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("BUILTIN_SCRIPT_NOT_FOUND"));
    }

    @Test
    void listUserPaginatesAndFiltersByNameAndTag() throws Exception {
        userCatalogue.create(new CreateScriptRequest("Voltage sample",
                wrapped("return 1;"), List.of("voltage")));
        userCatalogue.create(new CreateScriptRequest("Current sample",
                wrapped("return 2;"), List.of("current")));

        mockMvc.perform(get("/api/scripts/source/user")
                    .param("limit", "1").param("offset", "0")
                    .param("name", "voltage").param("tag", "voltage"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].id").value("test-1"))
                .andExpect(jsonPath("$.items[0].sourceCode").doesNotExist());
    }

    @Test
    void listUserTagsReturnsDistinctTagsAndCapsTheResponseAt256() throws Exception {
        for (int sourceIndex = 0; sourceIndex < 26; sourceIndex++) {
            var tags = new java.util.ArrayList<String>();
            for (int tagIndex = 0; tagIndex < 10; tagIndex++) {
                tags.add("tag" + (sourceIndex * 10 + tagIndex));
            }
            userCatalogue.put(definition("tag-source-" + sourceIndex, "Tag source " + sourceIndex,
                    "return 1;", tags, ScriptDefinitionOrigin.USER));
        }

        mockMvc.perform(get("/api/scripts/source/user/tags"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(256));
    }

    @Test
    void createUserReturnsLocationAndNormalizedTags() throws Exception {
        mockMvc.perform(post("/api/scripts/source/user").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Voltage sample\",\"sourceCode\":\"(() => { return 1; })();\",\"tags\":[\"Voltage\"]}"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/scripts/source/user/test-1"))
                .andExpect(jsonPath("$.tags[0]").value("voltage"));
    }

    @Test
    void createUserRejectsInvalidRequest() throws Exception {
        mockMvc.perform(post("/api/scripts/source/user").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"sourceCode\":\"(() => { return 1; })();\",\"tags\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void getUserReturnsDefinitionAndReportsMissingDefinition() throws Exception {
        userCatalogue.create(
                new CreateScriptRequest("Voltage sample", wrapped("return 1;"), List.of("voltage")));

        mockMvc.perform(get("/api/scripts/source/user/test-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sourceCode").value(wrapped("return 1;")));

        mockMvc.perform(get("/api/scripts/source/user/missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("USER_SCRIPT_NOT_FOUND"));
    }

    @Test
    void replaceUserReturnsUpdatedDefinitionAndReportsMissingDefinition() throws Exception {

        userCatalogue.create(
                new CreateScriptRequest("Voltage sample", wrapped("return 1;"), List.of("voltage")));

        mockMvc.perform(put("/api/scripts/source/user/test-1").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Updated\",\"sourceCode\":\"(() => { return 3; })();\",\"tags\":[\"updated\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sourceCode").value(wrapped("return 3;")))
                .andExpect(jsonPath("$.tags[0]").value("updated"));

       mockMvc.perform(put("/api/scripts/source/user/missing").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Updated\",\"sourceCode\":\"(() => { return 3; })();\",\"tags\":[]}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("USER_SCRIPT_NOT_FOUND"));
    }

    @Test
    void deleteUserReturnsNoContentAndReportsMissingDefinition() throws Exception {
        userCatalogue.create(
                new CreateScriptRequest("Voltage sample", wrapped("return 1;"), List.of("voltage")));

        mockMvc.perform(delete("/api/scripts/source/user/test-1")).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/scripts/source/user/test-1"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("USER_SCRIPT_NOT_FOUND"));
    }

    private static ScriptDefinition definition(
            String id, String name, String sourceCode, List<String> tags, ScriptDefinitionOrigin origin) {
        return new ScriptDefinition(new ScriptDefinitionId(id), name, wrapped(sourceCode), tags, origin, Instant.EPOCH,
                Instant.EPOCH);
    }

    private static String wrapped(String source) {
        return "(() => { " + source + " })();";
    }
}
