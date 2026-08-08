package com.psuext.script.management.api;

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

import com.psuext.script.management.model.CreateScriptRequest;
import com.psuext.script.management.model.ScriptDefinition;
import com.psuext.script.management.model.ScriptDefinitionId;
import com.psuext.script.management.model.ScriptDefinitionPage;
import com.psuext.script.management.model.ScriptDefinitionQuery;
import com.psuext.script.management.model.UpdateScriptRequest;
import java.util.Optional;

/**
 * Stable application boundary for one script-definition origin.
 *
 * <p>A catalogue owns script definitions, not execution tasks. Implementations expose either the mutable
 * {@code USER} namespace or the immutable {@code BUILTIN} namespace, so callers never need to merge
 * collision-prone identifiers. All inputs and returned models are validated immutable boundary values.</p>
 */
public interface ScriptCatalogue {

    /**
     * Finds definitions using validated filters before applying offset/limit paging.
     *
     * @param query normalized page, name-search, and tag-search criteria
     * @return matching definitions and their total count before paging
     */
    ScriptDefinitionPage list(ScriptDefinitionQuery query);

    /**
     * Resolves one complete definition by its stable identifier.
     *
     * @param id validated identifier in this catalogue's namespace
     * @return immutable definition when it exists
     */
    Optional<ScriptDefinition> find(ScriptDefinitionId id);

    /**
     * Creates a definition when the catalogue supports mutation.
     *
     * @param request validated user-supplied definition state without an identifier
     * @return newly stored definition with its catalogue-generated identifier
     * @throws UnsupportedCatalogueOperationException when this origin is read-only
     */
    ScriptDefinition create(CreateScriptRequest request);

    /**
     * Replaces the mutable state of an existing definition while retaining its identifier.
     *
     * @param id validated identifier in this catalogue's namespace
     * @param request complete validated replacement state
     * @return updated immutable definition
     * @throws UnsupportedCatalogueOperationException when this origin is read-only
     */
    ScriptDefinition replace(ScriptDefinitionId id, UpdateScriptRequest request);

    /**
     * Deletes one definition when the catalogue supports mutation.
     *
     * @param id validated identifier in this catalogue's namespace
     * @return {@code true} only when an existing definition was removed
     * @throws UnsupportedCatalogueOperationException when this origin is read-only
     */
    boolean delete(ScriptDefinitionId id);
}
