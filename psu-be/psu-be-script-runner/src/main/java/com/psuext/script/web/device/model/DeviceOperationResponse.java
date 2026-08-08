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

/**
 * Stable response for device lifecycle operations and unsupported operations.
 *
 * @param operation requested operation
 * @param code stable result code
 * @param message human-readable result detail
 */
public record DeviceOperationResponse(
        String operation,
        String code,
        String message) {

    /**
     * Creates the standard response for an operation not implemented yet.
     *
     * @param operation unsupported operation name
     * @return unsupported operation response
     */
    public static DeviceOperationResponse unsupported(String operation) {
        return new DeviceOperationResponse(
                operation,
                "OPERATION_NOT_SUPPORTED",
                "Device " + operation + " is not supported yet");
    }
}
