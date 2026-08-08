package com.psuext.script.management.config;

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
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import org.junit.jupiter.api.Test;
import org.springframework.util.unit.DataSize;

class ScriptManagementPropertiesTest {

    @Test
    void exposesManagementDefaults() {
        var properties = new ScriptManagementProperties();

        assertThat(properties.getUserDirectory()).isEqualTo(java.nio.file.Path.of("./script-definitions"));
        assertThat(properties.getMaximumSourceCodeSize()).isEqualTo(DataSize.ofKilobytes(256));
    }

    @Test
    void rejectsInvalidValues() {
        var properties = new ScriptManagementProperties();

        assertThatIllegalArgumentException().isThrownBy(() -> properties.setUserDirectory(null));
        assertThatIllegalArgumentException().isThrownBy(() -> properties.setMaximumSourceCodeSize(DataSize.ofBytes(0)));
    }
}
