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

import com.psuext.script.management.model.CreateScriptRequest;
import com.psuext.script.management.model.UpdateScriptRequest;
import java.util.List;

/** HTTP payload for creating or replacing a user-owned script source. */
public record ScriptSourceRequest(String name, String sourceCode, List<String> tags) {

    /** @return validated domain request for creating a user script */
    public CreateScriptRequest toCreateRequest() {
        return new CreateScriptRequest(name, sourceCode, tags);
    }

    /** @return validated domain request for replacing a user script */
    public UpdateScriptRequest toUpdateRequest() {
        return new UpdateScriptRequest(name, sourceCode, tags);
    }
}
