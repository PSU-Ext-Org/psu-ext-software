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

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;
import java.nio.file.Path;

/**
 * Configuration for user-owned script definitions, independent of task artifact storage.
 *
 * <p>Relative directories resolve from the process working directory. The catalogue creates the directory
 * lazily, so merely starting the application never creates user data.</p>
 */
@ConfigurationProperties("psu.scripts.management")
public class ScriptManagementProperties {

    private Path userDirectory = Path.of("./script-definitions");
    private DataSize maximumSourceCodeSize = DataSize.ofKilobytes(256);

    /** @return root directory containing one child directory for each user definition */
    public Path getUserDirectory() {
        return userDirectory;
    }

    /** @param userDirectory root directory for user definitions; it is normalized by the persistence adapter */
    public void setUserDirectory(Path userDirectory) {
        if (userDirectory == null || userDirectory.toString().isBlank()) {
            throw new IllegalArgumentException("userDirectory must not be blank");
        }
        this.userDirectory = userDirectory;
    }

    /** @return largest allowed UTF-8 source-code payload before persistence is attempted */
    public DataSize getMaximumSourceCodeSize() {
        return maximumSourceCodeSize;
    }

    /** @param maximumSourceCodeSize positive largest allowed UTF-8 source-code payload */
    public void setMaximumSourceCodeSize(DataSize maximumSourceCodeSize) {
        if (maximumSourceCodeSize == null || maximumSourceCodeSize.toBytes() <= 0) {
            throw new IllegalArgumentException("maximumSourceCodeSize must be positive");
        }
        this.maximumSourceCodeSize = maximumSourceCodeSize;
    }
}
