package com.psuext.script.web.scripts.controller;

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

import static com.psuext.script.management.config.ScriptManagementConfiguration.BUILTIN_SCRIPT_CATALOGUE;
import static com.psuext.script.management.config.ScriptManagementConfiguration.USER_SCRIPT_CATALOGUE;

import com.psuext.script.management.api.ScriptCatalogue;
import com.psuext.script.management.api.ScriptTagHintService;
import com.psuext.script.management.model.ScriptDefinitionId;
import com.psuext.script.management.model.ScriptDefinitionQuery;
import com.psuext.script.web.execution.handler.ScriptResourceNotFoundException;
import com.psuext.script.web.scripts.models.ScriptSourceDetailResponse;
import com.psuext.script.web.scripts.models.ScriptSourcePageResponse;
import com.psuext.script.web.scripts.models.ScriptSourceRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.net.URI;
import java.util.List;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** HTTP resource adapter for the separate builtin and user script-source catalogues. */
@RestController
@RequestMapping("/api/scripts/source")
@Tag(name = "Script sources", description = "Packaged and user-managed script definitions")
public final class ScriptSourceController {

    private static final Logger LOGGER = LoggerFactory.getLogger(ScriptSourceController.class);
    private final ScriptCatalogue builtinCatalogue;
    private final ScriptCatalogue userCatalogue;
    private final ScriptTagHintService userScriptTagHintService;

    /** Creates the controller with explicitly qualified catalogue namespaces. */
    public ScriptSourceController(
            @Qualifier(BUILTIN_SCRIPT_CATALOGUE) ScriptCatalogue builtinCatalogue,
            @Qualifier(USER_SCRIPT_CATALOGUE) ScriptCatalogue userCatalogue,
            ScriptTagHintService userScriptTagHintService) {
        this.builtinCatalogue = builtinCatalogue;
        this.userCatalogue = userCatalogue;
        this.userScriptTagHintService = userScriptTagHintService;
    }

    /** Lists packaged immutable script sources. */
    @GetMapping("/builtin")
    @Operation(summary = "List builtin script sources")
    @ApiResponses({@ApiResponse(responseCode = "200", description = "Builtin script source page"),
            @ApiResponse(responseCode = "400", description = "Invalid query")})
    public ScriptSourcePageResponse listBuiltin(
            @Parameter(description = "Page size from 1 to 500")
            @RequestParam(name = "limit", defaultValue = "100") int limit,
            @Parameter(description = "Zero-based page offset")
            @RequestParam(name = "offset", defaultValue = "0") int offset,
            @Parameter(description = "Case-insensitive name substring")
            @RequestParam(name = "name", required = false) String name,
            @Parameter(description = "Repeatable tag filter; any requested tag matches")
            @RequestParam(name = "tag", required = false) List<String> tags) {
        return list("builtin", builtinCatalogue, limit, offset, name, tags);
    }

    /** Reads one packaged immutable script source. */
    @GetMapping("/builtin/{id}")
    @Operation(summary = "Get builtin script source")
    @ApiResponses({@ApiResponse(responseCode = "200", description = "Builtin script source"),
            @ApiResponse(responseCode = "400", description = "Invalid ID"),
            @ApiResponse(responseCode = "404", description = "Builtin script source was not found")})
    public ScriptSourceDetailResponse getBuiltin(@PathVariable("id") String id) {
        return find("builtin", builtinCatalogue, id, "BUILTIN_SCRIPT_NOT_FOUND");
    }

    /** Lists user-managed script sources. */
    @GetMapping("/user")
    @Operation(summary = "List user script sources")
    @ApiResponses({@ApiResponse(responseCode = "200", description = "User script source page"),
            @ApiResponse(responseCode = "400", description = "Invalid query"),
            @ApiResponse(responseCode = "500", description = "Script storage failed")})
    public ScriptSourcePageResponse listUser(
            @Parameter(description = "Page size from 1 to 500")
            @RequestParam(name = "limit", defaultValue = "100") int limit,
            @Parameter(description = "Zero-based page offset")
            @RequestParam(name = "offset", defaultValue = "0") int offset,
            @Parameter(description = "Case-insensitive name substring")
            @RequestParam(name = "name", required = false) String name,
            @Parameter(description = "Repeatable tag filter; any requested tag matches")
            @RequestParam(name = "tag", required = false) List<String> tags) {
        return list("user", userCatalogue, limit, offset, name, tags);
    }

    /**
     * Lists distinct tag suggestions from the most recently updated user script sources.
     *
     * <p>The result is capped to keep save and search hint payloads bounded. Tags retain the catalogue's
     * newest-first source order.</p>
     */
    @GetMapping("/user/tags")
    @Operation(summary = "List recent user script tags")
    @ApiResponse(responseCode = "200", description = "Up to 256 distinct tag suggestions")
    public List<String> listUserTags() {
        LOGGER.info("User script tag hints requested");
        List<String> tags = userScriptTagHintService.recentTags();
        LOGGER.debug("User script tag hints returned: tagCount={}", tags.size());
        return tags;
    }

    /** Creates one user-managed script source. */
    @PostMapping("/user")
    @Operation(summary = "Create user script source")
    @ApiResponses({@ApiResponse(responseCode = "201", description = "Created user script source"),
            @ApiResponse(responseCode = "400", description = "Invalid request"),
            @ApiResponse(responseCode = "409", description = "Generated ID conflict"),
            @ApiResponse(responseCode = "500", description = "Script storage failed")})
    public ResponseEntity<ScriptSourceDetailResponse> createUser(@RequestBody ScriptSourceRequest request) {
        LOGGER.info("User script source create requested: name={} sourceLength={} tagCount={}",
                request.name(), lengthOf(request.sourceCode()), sizeOf(request.tags()));
        var definition = userCatalogue.create(request.toCreateRequest());
        LOGGER.info("User script source created: id={} name={}", definition.id().value(), definition.name());
        return ResponseEntity.created(URI.create("/api/scripts/source/user/" + definition.id().value()))
                .body(ScriptSourceDetailResponse.from(definition));
    }

    /** Reads one user-managed script source. */
    @GetMapping("/user/{id}")
    @Operation(summary = "Get user script source")
    @ApiResponses({@ApiResponse(responseCode = "200", description = "User script source"),
            @ApiResponse(responseCode = "400", description = "Invalid ID"),
            @ApiResponse(responseCode = "404", description = "User script source was not found"),
            @ApiResponse(responseCode = "500", description = "Script storage failed")})
    public ScriptSourceDetailResponse getUser(@PathVariable("id") String id) {
        return find("user", userCatalogue, id, "USER_SCRIPT_NOT_FOUND");
    }

    /** Replaces one user-managed script source. */
    @PutMapping("/user/{id}")
    @Operation(summary = "Replace user script source")
    @ApiResponses({@ApiResponse(responseCode = "200", description = "Replaced user script source"),
            @ApiResponse(responseCode = "400", description = "Invalid request or ID"),
            @ApiResponse(responseCode = "404", description = "User script source was not found"),
            @ApiResponse(responseCode = "500", description = "Script storage failed"),
            @ApiResponse(responseCode = "501", description = "Operation is not supported")})
    public ScriptSourceDetailResponse replaceUser(
            @PathVariable("id") String id, @RequestBody ScriptSourceRequest request) {
        LOGGER.info("User script source replace requested: id={} name={} sourceLength={} tagCount={}",
                id, request.name(), lengthOf(request.sourceCode()), sizeOf(request.tags()));
        var definitionId = id(id);
        if (userCatalogue.find(definitionId).isEmpty()) {
            throw missing("USER_SCRIPT_NOT_FOUND", id);
        }
        ScriptSourceDetailResponse response = ScriptSourceDetailResponse.from(
                userCatalogue.replace(definitionId, request.toUpdateRequest()));
        LOGGER.info("User script source replaced: id={} name={}", response.id(), response.name());
        return response;
    }

    /** Deletes one user-managed script source. */
    @DeleteMapping("/user/{id}")
    @Operation(summary = "Delete user script source")
    @ApiResponses({@ApiResponse(responseCode = "204", description = "Deleted user script source"),
            @ApiResponse(responseCode = "400", description = "Invalid ID"),
            @ApiResponse(responseCode = "404", description = "User script source was not found"),
            @ApiResponse(responseCode = "500", description = "Script storage failed"),
            @ApiResponse(responseCode = "501", description = "Operation is not supported")})
    public ResponseEntity<Void> deleteUser(@PathVariable("id") String id) {
        LOGGER.info("User script source delete requested: id={}", id);
        if (!userCatalogue.delete(id(id))) {
            throw missing("USER_SCRIPT_NOT_FOUND", id);
        }
        LOGGER.info("User script source deleted: id={}", id);
        return ResponseEntity.noContent().build();
    }

    private static ScriptSourcePageResponse list(
            String origin,
            ScriptCatalogue catalogue, int limit, int offset, String name, List<String> tags) {
        LOGGER.info("Script source list requested: origin={} limit={} offset={} name={} tagCount={}",
                origin, limit, offset, name, sizeOf(tags));
        ScriptSourcePageResponse response = ScriptSourcePageResponse.from(
                catalogue.list(new ScriptDefinitionQuery(limit, offset, name, tags)));
        LOGGER.debug("Script source list returned: origin={} itemCount={} total={}",
                origin, response.items().size(), response.total());
        return response;
    }

    private static ScriptSourceDetailResponse find(String origin, ScriptCatalogue catalogue, String id, String code) {
        LOGGER.info("Script source requested: origin={} id={}", origin, id);
        ScriptSourceDetailResponse response = catalogue.find(id(id)).map(ScriptSourceDetailResponse::from)
                .orElseThrow(() -> missing(code, id));
        LOGGER.debug("Script source returned: origin={} id={} name={}", origin, response.id(), response.name());
        return response;
    }

    private static ScriptDefinitionId id(String value) {
        return new ScriptDefinitionId(value);
    }

    private static ScriptResourceNotFoundException missing(String code, String id) {
        return new ScriptResourceNotFoundException(code, "Script source not found: " + id);
    }

    private static int lengthOf(String value) {
        return value == null ? 0 : value.length();
    }

    private static int sizeOf(List<?> values) {
        return values == null ? 0 : values.size();
    }
}
