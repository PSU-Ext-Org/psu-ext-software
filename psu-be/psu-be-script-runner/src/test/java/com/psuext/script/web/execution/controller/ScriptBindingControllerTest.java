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

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ScriptBindingControllerTest {

    @Test
    void exposesEveryRuntimeBindingForEditorCompletion() {
        var response = new ScriptBindingController().list();

        assertThat(response.items()).extracting(item -> item.name())
                .containsExactly("query", "queryRaw", "queryBinary", "write", "sleep", "input", "cancelled", "progress", "log", "record");
        assertThat(response.items()).allSatisfy(item -> {
            assertThat(item.signature()).isNotBlank();
            assertThat(item.snippet()).isNotBlank();
            assertThat(item.documentation()).isNotBlank();
        });
    }
}
