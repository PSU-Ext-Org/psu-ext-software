package com.psuext.script.web.scripts.models;

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

import com.psuext.script.management.model.ScriptDefinition;
import com.psuext.script.management.model.ScriptDefinitionOrigin;
import java.time.Instant;
import java.util.List;

/** Complete immutable script definition returned from a detail or mutation operation. */
public record ScriptSourceDetailResponse(
        String id, String name, String sourceCode, List<String> tags, ScriptDefinitionOrigin origin,
        Instant createdAt, Instant updatedAt, Integer position) {

    /** @param definition immutable domain definition @return explicit detail response mapping */
    public static ScriptSourceDetailResponse from(ScriptDefinition definition) {
        return new ScriptSourceDetailResponse(definition.id().value(), definition.name(), definition.sourceCode(),
                definition.tags(), definition.origin(), definition.createdAt(), definition.updatedAt(), definition.position());
    }
}
