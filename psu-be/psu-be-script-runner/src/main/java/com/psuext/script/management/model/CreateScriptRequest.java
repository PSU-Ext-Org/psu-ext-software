package com.psuext.script.management.model;

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

import java.util.List;

/**
 * Validated input for creating a user-owned script definition.
 *
 * <p>Clients provide content but never an identifier or origin. The mutable catalogue creates those values after
 * accepting the request.</p>
 */
public record CreateScriptRequest(String name, String sourceCode, List<String> tags) {

    /** Normalizes the name and tags while preserving JavaScript source text exactly. */
    public CreateScriptRequest {
        name = ScriptDefinitionValidation.name(name);
        sourceCode = ScriptDefinitionValidation.sourceCode(sourceCode);
        tags = ScriptDefinitionValidation.tags(tags);
    }
}
