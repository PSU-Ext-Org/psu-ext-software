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

import com.psuext.script.execution.model.ScriptTaskId;
import com.psuext.script.execution.model.ScriptTaskSnapshot;
import com.psuext.script.execution.model.ScriptTaskState;
import com.psuext.script.execution.service.ScriptRunnerService;
import com.psuext.script.web.execution.handler.ScriptResourceNotFoundException;
import com.psuext.script.web.execution.util.ScriptTaskIdResolver;
import com.psuext.script.web.execution.model.ScriptCancelResponse;
import com.psuext.script.web.execution.model.ScriptSubmitRequest;
import com.psuext.script.web.execution.model.ScriptTaskAcceptedResponse;
import com.psuext.script.web.execution.model.ScriptTaskResultResponse;
import com.psuext.script.web.execution.model.ScriptTaskStatusResponse;
import com.psuext.script.web.execution.model.ScriptTaskPageResponse;
import com.psuext.script.web.execution.model.ScriptInputRequest;
import com.psuext.script.execution.service.ScriptInputNotPendingException;
import com.psuext.script.execution.model.ScriptTaskQuery;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * HTTP resource adapter for script task submission, status, results, and cancellation.
 */
@RestController
@RequestMapping("/api/scripts")
@Tag(name = "Script tasks", description = "Script execution lifecycle and results")
public final class ScriptTaskController {

    private static final Logger LOGGER = LoggerFactory.getLogger(ScriptTaskController.class);
    private final ScriptRunnerService runner;
    private final ScriptTaskIdResolver taskIdResolver;

    /** Creates the script task resource adapter. */
    public ScriptTaskController(ScriptRunnerService runner, ScriptTaskIdResolver taskIdResolver) {
        this.runner = runner;
        this.taskIdResolver = taskIdResolver;
    }

    /** Starts one background script task. */
    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Operation(summary = "Submit a script task")
    public ScriptTaskAcceptedResponse submit(@RequestBody ScriptSubmitRequest request) {
        LOGGER.info("Script task submit requested: name={} sourceLength={} timeoutMs={}",
                request.name(), lengthOf(request.source()), timeoutMillis(request));
        ScriptTaskId taskId = runner.start(request.toDomain());
        ScriptTaskState state = runner.getTask(taskId).map(ScriptTaskSnapshot::state)
                .orElse(ScriptTaskState.QUEUED);
        LOGGER.debug("Script task submit accepted: taskId={} state={}", taskId, state);
        return new ScriptTaskAcceptedResponse(taskId.toString(), state);
    }

    /** Returns one live task snapshot. */
    @GetMapping("/{taskId}")
    @Operation(summary = "Get script task status")
    public ScriptTaskStatusResponse status(@PathVariable("taskId") String taskId) {
        LOGGER.info("Script task status requested: taskId={}", taskId);
        ScriptTaskId id = taskIdResolver.resolve(taskId);
        ScriptTaskStatusResponse response = runner.getTask(id).map(ScriptTaskStatusResponse::from)
                .orElseThrow(() -> missing("TASK_NOT_FOUND", taskId));
        LOGGER.debug("Script task status returned: taskId={} state={}", taskId, response.state());
        return response;
    }

    /** Returns one stored terminal task result. */
    @GetMapping("/{taskId}/result")
    @Operation(summary = "Get script task result")
    public ScriptTaskResultResponse result(@PathVariable("taskId") String taskId) {
        LOGGER.info("Script task result requested: taskId={}", taskId);
        ScriptTaskId id = taskIdResolver.resolve(taskId);
        ScriptTaskResultResponse response = runner.getResult(id).map(ScriptTaskResultResponse::from)
                .orElseThrow(() -> missing("RESULT_NOT_FOUND", taskId));
        LOGGER.debug("Script task result returned: taskId={} state={}", taskId, response.finalStatus());
        return response;
    }

    /** Requests cancellation of one task. */
    @PostMapping("/{taskId}/cancel")
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Operation(summary = "Cancel a script task")
    public ScriptCancelResponse cancel(@PathVariable("taskId") String taskId) {
        LOGGER.info("Script task cancellation requested: taskId={}", taskId);
        ScriptTaskId id = taskIdResolver.resolve(taskId);
        if (runner.getTask(id).isEmpty()) {
            throw missing("TASK_NOT_FOUND", taskId);
        }
        boolean accepted = runner.cancel(id);
        ScriptTaskState state = runner.getTask(id).map(ScriptTaskSnapshot::state).orElse(null);
        LOGGER.info("Script task cancellation processed: taskId={} accepted={} state={}", taskId, accepted, state);
        return new ScriptCancelResponse(taskId, accepted, state);
    }

    /** Resolves the current operator-input request for one script task. */
    @PostMapping("/{taskId}/input")
    @Operation(summary = "Submit script operator input")
    public ScriptTaskStatusResponse input(
            @PathVariable("taskId") String taskId,
            @RequestBody ScriptInputRequest request) {
        ScriptTaskId id = taskIdResolver.resolve(taskId);
        if (runner.getTask(id).isEmpty()) {
            throw missing("TASK_NOT_FOUND", taskId);
        }
        if (!runner.submitInput(id, request.requestId(), request.value())) {
            throw new ScriptInputNotPendingException();
        }
        return runner.getTask(id).map(ScriptTaskStatusResponse::from)
                .orElseThrow(() -> missing("TASK_NOT_FOUND", taskId));
    }

    /** Lists active and historical tasks, newest first by task creation time. */
    @GetMapping
    @Operation(summary = "List script tasks")
    public ScriptTaskPageResponse list(
            @RequestParam(value = "limit", defaultValue = "100") int limit,
            @RequestParam(value = "offset", defaultValue = "0") int offset) {
        LOGGER.info("Script tasks requested: limit={} offset={}", limit, offset);
        ScriptTaskPageResponse response = ScriptTaskPageResponse.from(runner.listTasks(new ScriptTaskQuery(limit, offset)));
        LOGGER.debug("Script tasks returned: count={} total={}", response.items().size(), response.total());
        return response;
    }

    private static ScriptResourceNotFoundException missing(String code, String taskId) {
        return new ScriptResourceNotFoundException(code, "Task not found: " + taskId);
    }

    private static int lengthOf(String value) {
        return value == null ? 0 : value.length();
    }

    private static Long timeoutMillis(ScriptSubmitRequest request) {
        return request.timeout() == null ? null : request.timeout().toMillis();
    }
}
