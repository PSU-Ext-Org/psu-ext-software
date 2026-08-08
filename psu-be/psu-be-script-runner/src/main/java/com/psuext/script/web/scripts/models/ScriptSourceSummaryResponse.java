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

/** Source-code-free script definition returned from a list operation. */
public record ScriptSourceSummaryResponse(
        String id,
        String name,
        List<String> tags,
        ScriptDefinitionOrigin origin,
        Instant createdAt,
        Instant updatedAt,
        Integer position) {

    /** @param definition immutable domain definition @return explicit list response mapping */
    public static ScriptSourceSummaryResponse from(ScriptDefinition definition) {
        return new ScriptSourceSummaryResponse(definition.id().value(), definition.name(), definition.tags(),
                definition.origin(), definition.createdAt(), definition.updatedAt(), definition.position());
    }
}
