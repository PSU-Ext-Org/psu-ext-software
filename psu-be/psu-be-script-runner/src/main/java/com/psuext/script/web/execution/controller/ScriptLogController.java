package com.psuext.script.web.execution.controller;

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

import java.nio.charset.StandardCharsets;

import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.storage.ScriptTaskLogRange;
import com.psuext.script.execution.storage.ScriptTaskLogRead;
import com.psuext.script.execution.storage.ScriptTaskLogReadService;
import com.psuext.script.web.execution.handler.ScriptResourceNotFoundException;
import com.psuext.script.web.execution.util.ScriptTaskIdResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

/**
 * HTTP resource adapter that streams operational logs without buffering full files.
 */
@RestController
@RequestMapping("/api/scripts")
@Tag(name = "Script logs", description = "Script task operational logs")
public final class ScriptLogController {

    private static final Logger LOGGER = LoggerFactory.getLogger(ScriptLogController.class);
    private final ScriptTaskLogReadService logReadService;
    private final ScriptTaskIdResolver taskIdResolver;

    /** Creates the script log resource adapter. */
    public ScriptLogController(ScriptTaskLogReadService logReadService, ScriptTaskIdResolver taskIdResolver) {
        this.logReadService = logReadService;
        this.taskIdResolver = taskIdResolver;
    }

    /**
     * Streams a character range of one task's plain-text operational log.
     *
     * <p>Omit both range parameters to stream the full log. Supplying {@code offset} and {@code limit}
     * streams only that range without buffering the complete file in memory. Set {@code download} to request
     * a browser attachment response for the full-log download action.
     *
     * @param taskId task identifier
     * @param offset zero-based character offset
     * @param limit maximum number of characters to stream, or {@code null} for the remaining log
     * @param download whether to return an attachment response
     * @param downloadName requested attachment filename when downloading
     * @return streamed plain-text response
     */
    @GetMapping(value = "/{taskId}/log", produces = MediaType.TEXT_PLAIN_VALUE)
    @Operation(summary = "Get script task log")
    @SuppressWarnings("resource") // The streaming callback owns and closes the reader.
    public ResponseEntity<StreamingResponseBody> log(
            @PathVariable("taskId") String taskId,
            @RequestParam(value = "offset", defaultValue = "0") long offset,
            @RequestParam(value = "limit", required = false) Long limit,
            @RequestParam(value = "download", defaultValue = "false") boolean download,
            @RequestParam(value = "downloadName", required = false) String downloadName
    ) {
        ScriptTaskLogRange range = new ScriptTaskLogRange(offset, limit);
        LOGGER.info("Script task log requested: taskId={} offset={} limit={}", taskId, offset, limit);
        ScriptTaskId id = taskIdResolver.resolve(taskId);
        ScriptTaskLogRead logRead = logReadService.open(id, range)
                .orElseThrow(() -> new ScriptResourceNotFoundException(
                        "LOG_NOT_FOUND", "Task log not found: " + taskId));
        LOGGER.debug("Script task log stream opened: taskId={}", taskId);
        StreamingResponseBody body = output -> {
            try (logRead) {
                logRead.writeTo(output);
                LOGGER.debug("Script task log stream completed: taskId={}", taskId);
            } catch (java.io.IOException exception) {
                LOGGER.warn("Script task log stream failed: taskId={} error={}",
                        taskId, exception.getClass().getSimpleName());
                throw exception;
            }
        };

        ResponseEntity.BodyBuilder response = ResponseEntity.ok()
                .contentType(MediaType.TEXT_PLAIN)
                .header("X-Log-Offset", String.valueOf(offset));
        if (limit != null) {
            response.header("X-Log-Limit", String.valueOf(limit));
        }
        if (download) {
            response.header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                    .filename(downloadFileName(id, downloadName), StandardCharsets.UTF_8)
                    .build()
                    .toString());
        }

        return response.body(body);
    }

    private static String downloadFileName(ScriptTaskId taskId, String requestedName) {
        if (requestedName == null || requestedName.isBlank()) {
            return "script-task-" + taskId + ".log";
        }
        if (requestedName.length() > 200 || requestedName.indexOf('\r') >= 0 || requestedName.indexOf('\n') >= 0) {
            throw new IllegalArgumentException("downloadName must be a single filename of at most 200 characters");
        }
        return requestedName;
    }

}
