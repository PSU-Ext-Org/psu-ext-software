package com.psuext.transport.core.model;

/*-
 * #%L
 * PSU-BE Transport
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

import org.jspecify.annotations.NonNull;

/**
 * Concrete SCPI transport target.
 *
 * @param host target host name or IP address
 * @param port target TCP port
 */
public record ScpiTarget(String host, int port) {

    /**
     * Returns a compact host/port representation for logs and status messages.
     *
     * @return target formatted as {@code host:port}
     */
    @Override
    @NonNull
    public String toString() {
        return host + ":" + port;
    }
}


