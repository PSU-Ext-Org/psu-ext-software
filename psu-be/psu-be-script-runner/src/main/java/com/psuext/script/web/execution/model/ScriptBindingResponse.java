package com.psuext.script.web.execution.model;

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

import com.psuext.script.execution.runtime.ScriptBindingCatalogue.ScriptBindingDefinition;

/** HTTP representation of one JavaScript host-function completion. */
public record ScriptBindingResponse(String name, String signature, String snippet, String documentation) {
    public static ScriptBindingResponse from(ScriptBindingDefinition definition) {
        return new ScriptBindingResponse(definition.name(), definition.signature(), definition.snippet(),
                definition.documentation());
    }
}
