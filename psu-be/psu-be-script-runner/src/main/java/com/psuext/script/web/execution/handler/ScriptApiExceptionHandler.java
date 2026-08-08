package com.psuext.script.web.execution.handler;

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

import java.io.UncheckedIOException;

import com.psuext.script.execution.service.ScriptTaskRejectedException;
import com.psuext.script.execution.service.ScriptInputNotPendingException;
import com.psuext.script.management.api.ScriptDefinitionIdConflictException;
import com.psuext.script.management.api.UnsupportedCatalogueOperationException;
import com.psuext.script.management.file.ScriptDefinitionStorageException;
import com.psuext.script.web.scripts.controller.ScriptSourceController;
import com.psuext.script.web.execution.controller.ScriptEventsController;
import com.psuext.script.web.execution.controller.ScriptLogController;
import com.psuext.script.web.execution.controller.ScriptSeriesController;
import com.psuext.script.web.execution.controller.ScriptTaskController;
import com.psuext.script.web.execution.model.ScriptApiError;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Translates shared script HTTP-boundary failures to stable error responses.
 */
@RestControllerAdvice(assignableTypes = {
        ScriptTaskController.class,
        ScriptLogController.class,
        ScriptSeriesController.class,
        ScriptEventsController.class,
        ScriptSourceController.class
})
public final class ScriptApiExceptionHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(ScriptApiExceptionHandler.class);

    /** Maps malformed script requests to the existing invalid-request response. */
    @SuppressWarnings("unused") // Invoked reflectively by Spring MVC exception resolution.
    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ScriptApiError> invalidRequest(IllegalArgumentException exception) {
        LOGGER.warn("Script API invalid request: error={}", exception.getMessage());
        return ResponseEntity.badRequest().body(new ScriptApiError("INVALID_REQUEST", exception.getMessage()));
    }

    /** Maps absent task resources to their stable not-found response. */
    @SuppressWarnings("unused") // Invoked reflectively by Spring MVC exception resolution.
    @ExceptionHandler(ScriptResourceNotFoundException.class)
    ResponseEntity<ScriptApiError> notFound(ScriptResourceNotFoundException exception) {
        LOGGER.warn("Script API resource not found: code={} error={}", exception.code(), exception.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ScriptApiError(exception.code(), exception.getMessage()));
    }

    /** Maps a full execution queue to a stable overload response. */
    @SuppressWarnings("unused") // Invoked reflectively by Spring MVC exception resolution.
    @ExceptionHandler(ScriptTaskRejectedException.class)
    ResponseEntity<ScriptApiError> taskCapacityExceeded(ScriptTaskRejectedException exception) {
        LOGGER.warn("Script API task capacity exceeded: error={}", exception.getMessage());
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(new ScriptApiError("TASK_CAPACITY_EXCEEDED", exception.getMessage()));
    }

    /** Maps stale or duplicate input replies to a conflict response. */
    @SuppressWarnings("unused")
    @ExceptionHandler(ScriptInputNotPendingException.class)
    ResponseEntity<ScriptApiError> inputNotPending(ScriptInputNotPendingException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ScriptApiError("INPUT_NOT_PENDING", exception.getMessage()));
    }

    /** Maps log-open failures before streaming begins to a stable API error. */
    @SuppressWarnings("unused") // Invoked reflectively by Spring MVC exception resolution.
    @ExceptionHandler(UncheckedIOException.class)
    ResponseEntity<ScriptApiError> logReadFailure(UncheckedIOException exception) {
        LOGGER.error("Script API log read failed", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ScriptApiError("LOG_READ_FAILED", exception.getMessage()));
    }

    /** Maps durable user-script failures without exposing filesystem details. */
    @SuppressWarnings("unused")
    @ExceptionHandler(ScriptDefinitionStorageException.class)
    ResponseEntity<ScriptApiError> scriptStorageFailure(ScriptDefinitionStorageException exception) {
        LOGGER.error("Script API script storage failed", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ScriptApiError("SCRIPT_STORAGE_FAILED", "Script storage failed"));
    }

    /** Maps an unexpected generated script ID collision. */
    @SuppressWarnings("unused")
    @ExceptionHandler(ScriptDefinitionIdConflictException.class)
    ResponseEntity<ScriptApiError> scriptIdConflict(ScriptDefinitionIdConflictException exception) {
        LOGGER.warn("Script API script ID conflict: error={}", exception.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ScriptApiError("SCRIPT_ID_CONFLICT", exception.getMessage()));
    }

    /** Maps an intentionally immutable catalogue operation to a stable response. */
    @SuppressWarnings("unused")
    @ExceptionHandler(UnsupportedCatalogueOperationException.class)
    ResponseEntity<ScriptApiError> unsupportedCatalogueOperation(UnsupportedCatalogueOperationException exception) {
        LOGGER.warn("Script API unsupported catalogue operation: error={}", exception.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED)
                .body(new ScriptApiError("SCRIPT_OPERATION_NOT_SUPPORTED", exception.getMessage()));
    }
}
