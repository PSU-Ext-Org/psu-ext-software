package com.psuext.script.execution.runtime;

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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class GraalJsDependencyTest {

    @Test
    void restrictedContextEvaluatesJavaScript() {
        try (var context = new com.psuext.script.execution.runtime.RestrictedGraalJsContextFactory().create()) {

            assertThat(context.eval("js", "1 + 1").asInt()).isEqualTo(2);
        }
    }

    @Test
    void restrictedContextRejectsHostClassLookup() {
        try (var context = new com.psuext.script.execution.runtime.RestrictedGraalJsContextFactory().create()) {
            assertThatThrownBy(() -> context.eval("js", "Java.type('java.lang.String')"))
                    .hasMessageContaining("Access to host class");
        }
    }
}
