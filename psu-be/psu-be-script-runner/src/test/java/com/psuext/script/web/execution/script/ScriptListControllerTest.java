package com.psuext.script.web.execution.script;

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

import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.psuext.script.execution.model.ScriptTaskResultSummary;
import com.psuext.script.execution.storage.retention.ScriptRetentionPolicy;
import com.psuext.script.web.execution.script.support.ScriptControllerTestSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@Import(ScriptListControllerTest.ListRetentionConfiguration.class)
class ScriptListControllerTest extends ScriptControllerTestSupport {

    private static final int RETAINED_RESULT_COUNT = 5;

    @Autowired
    private ObjectMapper objectMapper;

    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry registry) {
        registerStorage(registry, "script-list-controller");
    }

    @Test
    void returnsEmptyListThenRetainsOnlyTheMostRecentCompletedResults() throws Exception {
        assertThat(results()).isEmpty();

        List<String> submittedNames = new ArrayList<>();
        for (int index = 0; index <= RETAINED_RESULT_COUNT; index++) {
            String name = "list-retention-" + index;
            submittedNames.add(name);
            submitAndAwaitCompleted(name, "return " + index + ";");
        }

        List<String> retainedNames = resultNames(results());
        assertThat(retainedNames)
                .hasSize(RETAINED_RESULT_COUNT)
                .containsExactlyInAnyOrderElementsOf(submittedNames.subList(1, submittedNames.size()))
                .doesNotContain(submittedNames.get(0));
        assertThat(resultNames(filteredResults()))
                .containsExactlyInAnyOrderElementsOf(retainedNames);
    }

    private JsonNode results() throws Exception {
        return objectMapper.readTree(get("/api/scripts?limit=100")).required("items");
    }

    private JsonNode filteredResults() throws Exception {
        return objectMapper.readTree(get("/api/scripts?limit=100&finalStatus=COMPLETED")).required("items");
    }

    private static List<String> resultNames(JsonNode results) {
        List<String> names = new ArrayList<>();
        for (JsonNode result : results) {
            names.add(result.required("name").asText());
        }
        return names;
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class ListRetentionConfiguration {

        @Bean
        @Primary
        ScriptRetentionPolicy listRetentionPolicy() {
            return (summaries, now) -> summaries.stream()
                    .sorted((left, right) -> right.endedAt().compareTo(left.endedAt()))
                    .skip(RETAINED_RESULT_COUNT)
                    .map(ScriptTaskResultSummary::taskId)
                    .toList();
        }
    }
}
