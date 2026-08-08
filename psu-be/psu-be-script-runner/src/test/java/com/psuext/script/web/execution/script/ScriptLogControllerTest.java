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

import java.util.List;

import com.psuext.script.web.execution.script.support.ScriptControllerTestSupport;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

class ScriptLogControllerTest extends ScriptControllerTestSupport {

    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry registry) {
        registerStorage(registry, "script-log-controller");
    }

    @Test
    void returnsEmptyLogWhenScriptWritesNoLines() {
        String taskId = submitAndAwaitCompleted("empty-log-script", "return 1;");

        assertThat(logLines(get("/api/scripts/" + taskId + "/log"))).isEmpty();
    }

    @Test
    void returnsAllLogLinesInWriteOrder() {
        String taskId = submitAndAwaitCompleted("multiple-log-lines", """
                (() => {
                log('INFO', 'first line');
                log('WARN', 'second line');
                log('ERROR', 'third line');
                return 1;
                })();
                """);

        List<String> lines = logLines(get("/api/scripts/" + taskId + "/log"));
        assertThat(lines)
                .hasSize(3)
                .anyMatch(line -> line.endsWith("INFO first line"))
                .anyMatch(line -> line.endsWith("WARN second line"))
                .anyMatch(line -> line.endsWith("ERROR third line"));
    }

    @Test
    void streamsOnlyTheRequestedLogRange() {
        String taskId = submitAndAwaitCompleted("paged-log", """
                (() => {
                log('INFO', 'first line');
                log('WARN', 'second line');
                return 1;
                })();
                """);
        String fullLog = get("/api/scripts/" + taskId + "/log");

        String page = restClient.get().uri(builder -> builder
                        .path("/api/scripts/{taskId}/log")
                        .queryParam("offset", 7)
                        .queryParam("limit", 19)
                        .build(taskId))
                .exchange().expectStatus().isOk()
                .expectHeader().valueEquals("X-Log-Offset", "7")
                .expectHeader().valueEquals("X-Log-Limit", "19")
                .expectBody(String.class).returnResult().getResponseBody();

        assertThat(page).isEqualTo(fullLog.substring(7, 26));
    }

    @Test
    void rejectsInvalidLogRange() {
        restClient.get().uri("/api/scripts/{taskId}/log?offset=-1", unknownTaskId())
                .exchange().expectStatus().isBadRequest();
        restClient.get().uri("/api/scripts/{taskId}/log?limit=0", unknownTaskId())
                .exchange().expectStatus().isBadRequest();
    }

    @Test
    void returnsAnAttachmentForFullLogDownload() {
        String taskId = submitAndAwaitCompleted("download-log", "(() => { return 1; })();");

        restClient.get().uri("/api/scripts/{taskId}/log?download=true&downloadName=log_test.txt", taskId)
                .exchange().expectStatus().isOk()
                .expectHeader().valueMatches("Content-Disposition", "attachment;.*log_test\\.txt.*");
    }

    @Test
    void returnsNotFoundForMissingLog() {
        String taskId = unknownTaskId();

        restClient.get().uri("/api/scripts/{taskId}/log", taskId)
                .exchange().expectStatus().isNotFound()
                .expectBody(String.class).value(body -> assertThat(body)
                        .contains("\"code\":\"LOG_NOT_FOUND\""));
    }

    private static List<String> logLines(String log) {
        return log == null || log.isEmpty() ? List.of() : log.lines().toList();
    }
}
