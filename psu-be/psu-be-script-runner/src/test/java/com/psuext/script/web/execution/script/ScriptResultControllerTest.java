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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.psuext.script.web.execution.script.support.ScriptControllerTestSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

class ScriptResultControllerTest extends ScriptControllerTestSupport {

    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry registry) {
        registerStorage(registry, "script-result-controller");
    }

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void returnsSimulatorQueryResult() {
        connect(DEVICE_ID);
        awaitConnected();
        String taskId = submit("idn-query", "return query('" + DEVICE_NAME + "', '*IDN?');");

        assertThat(awaitResult(taskId))
                .contains(IDN_RESPONSE)
                .contains("\"finalStatus\":\"COMPLETED\"");
    }

    @Test
    void returnsNoSeriesWhenScriptRecordsNoPoints() throws Exception {
        String taskId = submitAndAwaitCompleted("result-without-records", "return 1;");
        assertThat(resultForTask(taskId).required("series")).isEmpty();
    }

    @Test
    void returnsFirstRecordedPointInOneSeries() throws Exception {
        String taskId = submit("result-with-records", """
                record(new Date(), 'voltage', 'V', 1.0);
                record(new Date(), 'voltage', 'V', 2.5);
                record(new Date(), 'voltage', 'V', 3.75);
                return 1;
                """);

        JsonNode series = parseResult(awaitResult(taskId)).required("series");
        assertThat(series).hasSize(1);
        assertThat(series.get(0).required("name").asText()).isEqualTo("voltage");
        assertThat(series.get(0).required("unit").asText()).isEqualTo("V");
        assertThat(series.get(0).required("points"))
                .extracting(point -> point.required("value").asDouble())
                .containsExactly(1.0);
    }

    @Test
    void returnsNotFoundBeforeOrWithoutResult() {
        String taskId = unknownTaskId();

        restClient.get().uri("/api/scripts/{taskId}/result", taskId)
                .exchange().expectStatus().isNotFound()
                .expectBody(String.class).value(body -> assertThat(body)
                        .contains("\"code\":\"RESULT_NOT_FOUND\""));
    }

    private JsonNode resultForTask(String taskId) throws Exception {
        return objectMapper.readTree(awaitResult(taskId));
    }

    private JsonNode parseResult(String response) throws Exception {
        return objectMapper.readTree(response);
    }
}
