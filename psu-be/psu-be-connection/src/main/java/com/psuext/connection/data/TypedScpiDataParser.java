package com.psuext.connection.data;

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
 * Parses one typed SCPI DATA response.
 */
public interface TypedScpiDataParser {

    /**
     * Returns whether this parser supports the given command.
     *
     * @param command raw SCPI command
     * @return whether this parser supports the command
     */
    boolean supports(String command);

    /**
     * Parses one complete SCPI definite-length binary block.
     *
     * @param command raw SCPI command
     * @param binaryBlock complete SCPI binary block including header
     * @return parsed typed DATA payload
     */
    TypedScpiData parse(String command, byte[] binaryBlock);
}


