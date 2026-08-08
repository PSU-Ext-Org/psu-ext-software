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

import java.nio.file.Path;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configuration properties for the implemented file-backed script storage. */
@ConfigurationProperties("psu.scripts.storage")
public class ScriptStorageProperties {

    private Path directory = Path.of("script-storage");

    /** @return root directory containing one durable directory per task */
    public Path getDirectory() {
        return directory;
    }

    /** @param directory root directory containing one durable directory per task */
    public void setDirectory(Path directory) {
        this.directory = requireDirectory(directory);
    }

    private static Path requireDirectory(Path directory) {
        if (directory == null || directory.toString().isBlank()) {
            throw new IllegalArgumentException("directory" + " must not be blank");
        }
        return directory;
    }
}
