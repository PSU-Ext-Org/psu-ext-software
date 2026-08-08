package com.psuext.script.web.device;

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

class DeviceListControllerTest extends DeviceManagerControllerTestSupport {

    @Test
    void listsConfiguredDevices() {
        assertThat(get("/api/devices"))
                .contains("\"id\":" + DEVICE_ID)
                .contains("\"name\":\"" + DEVICE_NAME + "\"")
                .contains("\"id\":" + SECOND_DEVICE_ID)
                .contains("\"name\":\"" + SECOND_DEVICE_NAME + "\"")
                .contains("\"id\":" + THIRD_DEVICE_ID)
                .contains("\"name\":\"" + THIRD_DEVICE_NAME + "\"");
    }
}
