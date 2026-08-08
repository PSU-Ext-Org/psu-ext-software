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

import com.psuext.script.execution.runtime.ScriptBindingCatalogue;
import com.psuext.script.web.execution.model.ScriptBindingCatalogueResponse;
import com.psuext.script.web.execution.model.ScriptBindingResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Exposes JavaScript host-function metadata to script-editing clients. */
@RestController
@RequestMapping("/api/scripts/bindings")
@Tag(name = "Script bindings", description = "JavaScript host functions available to script tasks")
public final class ScriptBindingController {

    /** Returns all host functions installed into the script runtime. */
    @GetMapping
    @Operation(summary = "List JavaScript script bindings")
    public ScriptBindingCatalogueResponse list() {
        return new ScriptBindingCatalogueResponse(ScriptBindingCatalogue.definitions().stream()
                .map(ScriptBindingResponse::from)
                .toList());
    }
}
