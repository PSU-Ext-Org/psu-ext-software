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

class DeviceDisconnectControllerTest extends DeviceManagerControllerTestSupport {

    @Test
    void disconnectsDeviceById() {
        connect(DEVICE_ID);
        awaitConnected();

        disconnect(DEVICE_ID);
    }

    @Test
    void disconnectsDeviceByName() {
        connect(DEVICE_NAME);
        awaitConnected();

        disconnect(DEVICE_NAME);
    }

    @Test
    void disconnectMissingDeviceReturnsNotFound() {
        restClient.post().uri("/api/devices/MISSING/disconnect")
                .exchange().expectStatus().isNotFound()
                .expectBody(String.class).value(body -> assertThat(body)
                        .contains("\"operation\":\"disconnect\"")
                        .contains("\"code\":\"DEVICE_NOT_FOUND\""));
    }

    private void disconnect(Object idOrName) {
        restClient.post().uri("/api/devices/{idOrName}/disconnect", idOrName)
                .exchange().expectStatus().isOk()
                .expectBody(String.class).value(body -> assertThat(body)
                        .contains("\"operation\":\"disconnect\""));
    }
}
