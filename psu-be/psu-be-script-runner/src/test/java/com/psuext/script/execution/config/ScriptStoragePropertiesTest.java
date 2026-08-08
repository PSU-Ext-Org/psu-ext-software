package com.psuext.script.execution.config;

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

import java.nio.file.Path;

import com.psuext.script.execution.storage.ScriptResultStore;
import com.psuext.script.execution.storage.ScriptTaskLogStore;
import com.psuext.script.execution.storage.file.FileScriptResultStore;
import com.psuext.script.execution.storage.file.FileScriptTaskLogStore;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
        "psu.connection.devices.file=target/test-script-storage-devices.json",
        "psu.scripts.storage.directory=target/test-script-storage"
})
class ScriptStoragePropertiesTest {

    @Autowired
    private ScriptStorageProperties properties;

    @Autowired
    private ScriptResultStore resultStore;

    @Autowired
    private ScriptTaskLogStore logStore;

    @Test
    void bindsSharedTaskArtifactDirectory() {
        assertThat(properties.getDirectory()).isEqualTo(Path.of("target", "test-script-storage"));
        assertThat(resultStore).isInstanceOf(FileScriptResultStore.class);
        assertThat(logStore).isInstanceOf(FileScriptTaskLogStore.class);
    }
}
