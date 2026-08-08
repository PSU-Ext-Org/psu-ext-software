package com.psuext.script.web.device.model;

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

import com.psuext.transport.core.model.ScpiTransportState;

/**
 * HTTP representation of a device transport's current lifecycle state.
 *
 * @param state transport lifecycle state
 * @param lastError last transport error message when available
 */
public record DeviceTransportStatusResponse(
        ScpiTransportState state,
        String lastError) {
}
