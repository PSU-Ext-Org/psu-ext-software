package com.psuext.script.web.execution;

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

import com.psuext.script.web.device.support.DeviceManagerControllerTestSupport;
import org.junit.jupiter.api.Test;

class OpenApiDocumentationTest extends DeviceManagerControllerTestSupport {

    @Test
    void exposesDeviceAndScriptEndpoints() {
        assertThat(get("/v3/api-docs"))
                .contains("/api/devices")
                .contains("/api/scripts");
    }
}
