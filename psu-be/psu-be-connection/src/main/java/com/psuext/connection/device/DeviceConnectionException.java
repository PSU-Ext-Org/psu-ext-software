package com.psuext.connection.device;

/*-
 * #%L
 * PSU-BE Connection
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
 * Domain exception for invalid device registry operations.
 */
public class DeviceConnectionException extends RuntimeException {

    private final String code;

    /**
     * Creates a registry exception with a stable protocol error code.
     *
     * @param code stable error code
     * @param message human-readable error message
     */
    public DeviceConnectionException(String code, String message) {
        super(message);
        this.code = code;
    }

    /**
     * Returns the stable protocol error code.
     *
     * @return error code
     */
    public String code() {
        return code;
    }
}


