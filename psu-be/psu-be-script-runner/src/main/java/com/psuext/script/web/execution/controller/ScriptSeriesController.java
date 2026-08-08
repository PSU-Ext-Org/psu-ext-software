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
import com.psuext.script.execution.storage.ScriptResultStore;
import com.psuext.script.execution.storage.ScriptSeriesRange;
import com.psuext.script.execution.storage.ScriptTaskSeriesRead;
import com.psuext.script.web.execution.handler.ScriptResourceNotFoundException;
import com.psuext.script.web.execution.util.ScriptTaskIdResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

/** HTTP adapter for bounded JSON and CSV reads of stored script result series. */
@RestController
@RequestMapping("/api/scripts")
@Tag(name = "Script result series", description = "Stream stored script task result series")
public final class ScriptSeriesController {

    private final ScriptResultStore resultStore;
    private final ScriptTaskIdResolver taskIdResolver;

    /** Creates the stored-series resource adapter. */
    public ScriptSeriesController(ScriptResultStore resultStore, ScriptTaskIdResolver taskIdResolver) {
        this.resultStore = resultStore;
        this.taskIdResolver = taskIdResolver;
    }

    /** Streams a bounded JSON page of one named terminal-result series. */
    @GetMapping(value = "/{taskId}/series", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Get stored script task series")
    public ResponseEntity<StreamingResponseBody> series(
            @PathVariable("taskId") String taskId,
            @RequestParam("series") String seriesName,
            @RequestParam(value = "offset", defaultValue = "0") long offset,
            @RequestParam(value = "limit", required = false) Long limit) {
        ScriptTaskSeriesRead read = open(taskId, seriesName, new ScriptSeriesRange(offset, limit));
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(read::writeJsonTo);
    }

    /** Streams a bounded CSV page of one named terminal-result series. */
    @GetMapping(value = "/{taskId}/series/csv", produces = "text/csv")
    @Operation(summary = "Download stored script task series as CSV")
    public ResponseEntity<StreamingResponseBody> csv(
            @PathVariable("taskId") String taskId,
            @RequestParam("series") String seriesName,
            @RequestParam(value = "offset", defaultValue = "0") long offset,
            @RequestParam(value = "limit", required = false) Long limit,
            @RequestParam(value = "download", defaultValue = "false") boolean download,
            @RequestParam(value = "downloadName", required = false) String downloadName) {
        ScriptTaskSeriesRead read = open(taskId, seriesName, new ScriptSeriesRange(offset, limit));
        ResponseEntity.BodyBuilder response = ResponseEntity.ok().contentType(MediaType.parseMediaType("text/csv"));
        if (download) {
            response.header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                    .filename(downloadFileName(taskId, seriesName, downloadName), StandardCharsets.UTF_8).build().toString());
        }
        return response.body(read::writeCsvTo);
    }

    private ScriptTaskSeriesRead open(String taskId, String seriesName, ScriptSeriesRange range) {
        if (seriesName.isBlank()) {
            throw new IllegalArgumentException("series must not be blank");
        }
        ScriptTaskId id = taskIdResolver.resolve(taskId);
        return resultStore.openSeries(id, seriesName, range).orElseThrow(() -> new ScriptResourceNotFoundException(
                "SERIES_NOT_FOUND", "Task result series not found: " + seriesName));
    }

    private static String downloadFileName(String taskId, String seriesName, String requestedName) {
        if (requestedName != null && !requestedName.isBlank()) {
            if (requestedName.length() > 200 || requestedName.indexOf('\r') >= 0 || requestedName.indexOf('\n') >= 0) {
                throw new IllegalArgumentException("downloadName must be a single filename of at most 200 characters");
            }
            return requestedName;
        }
        String safeSeries = seriesName.replaceAll("[^A-Za-z0-9._-]+", "_");
        return "script-task-" + taskId + "-" + (safeSeries.isBlank() ? "series" : safeSeries) + ".csv";
    }
}
