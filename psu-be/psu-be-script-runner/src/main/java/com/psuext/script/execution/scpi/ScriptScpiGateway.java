package com.psuext.script.execution.scpi;

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

import com.psuext.transport.core.model.ScpiTransportResponse;

/**
 * Narrow SCPI gateway exposed to the script runtime.
 */
public interface ScriptScpiGateway {

    /**
     * Sends a non-query SCPI command.
     *
     * @param idOrName configured device id or name
     * @param command SCPI command without transport line ending
     */
    void write(String idOrName, String command);

    /**
     * Sends a text query and returns its raw text response.
     *
     * @param idOrName configured device id or name
     * @param command SCPI query without transport line ending
     * @return raw text response
     */
    String queryText(String idOrName, String command);

    /**
     * Sends a query and returns its complete SCPI definite-length binary block.
     *
     * @param idOrName configured device id or name
     * @param command SCPI query without transport line ending
     * @return complete binary block, including its SCPI header
     */
    byte[] queryBinary(String idOrName, String command);

    /**
     * Sends a raw SCPI command and returns the lower-level transport response.
     *
     * @param idOrName configured device id or name
     * @param command SCPI command without transport line ending
     * @return transport response
     */
    ScpiTransportResponse send(String idOrName, String command);

    /**
     * Returns whether a configured device exists.
     *
     * @param idOrName configured device id or name
     * @return whether the device exists
     */
    boolean deviceExists(String idOrName);
}
