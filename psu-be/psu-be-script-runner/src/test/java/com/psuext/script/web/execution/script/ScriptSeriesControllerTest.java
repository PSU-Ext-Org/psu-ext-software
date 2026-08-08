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

class ScriptSeriesControllerTest extends ScriptControllerTestSupport {

    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry registry) {
        registerStorage(registry, "script-series-controller");
    }

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void streamsPagedJsonAndCsvForOneStoredSeries() throws Exception {
        String taskId = submitAndAwaitCompleted("series", """
                record(new Date('2026-07-19T12:00:00Z'), 'voltage', 'V', 1.0);
                record(new Date('2026-07-19T12:00:01Z'), 'voltage', 'V', 2.5);
                record(new Date('2026-07-19T12:00:02Z'), 'voltage', 'V', 3.75);
                return 1;
                """);

        String json = get("/api/scripts/" + taskId + "/series?series=voltage&offset=1&limit=1");
        String csv = get("/api/scripts/" + taskId + "/series/csv?series=voltage&offset=1&limit=1");
        JsonNode value = objectMapper.readTree(json);

        assertThat(value.required("name").asText()).isEqualTo("voltage");
        assertThat(value.required("points")).extracting(point -> point.required("value").asDouble()).containsExactly(2.5);
        assertThat(csv).isEqualTo("\"name\",\"voltage\"\n\"unit\",\"V\"\ntimestamp,value\n2026-07-19T12:00:01Z,2.5\n");
    }

    @Test
    void rejectsInvalidSeriesRangeAndMissingSeries() {
        String taskId = submitAndAwaitCompleted("series-errors", "return 1;");

        restClient.get().uri("/api/scripts/{taskId}/series?series=missing&offset=-1", taskId)
                .exchange().expectStatus().isBadRequest();
        restClient.get().uri("/api/scripts/{taskId}/series?series=missing", taskId)
                .exchange().expectStatus().isNotFound();
    }
}
