package com.psuext.transport.tcp;

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

import java.util.Arrays;

/**
 * Typed TCP response read from the SCPI stream.
 */
public sealed interface ScpiTcpResponse permits TextScpiTcpResponse, BinaryScpiTcpResponse {
}

/**
 * Text response bytes read through the configured delimiter.
 *
 * @param bytes raw text response bytes
 */
record TextScpiTcpResponse(byte[] bytes) implements ScpiTcpResponse {

    TextScpiTcpResponse {
        bytes = Arrays.copyOf(bytes, bytes.length);
    }

    @Override
    public byte[] bytes() {
        return Arrays.copyOf(bytes, bytes.length);
    }
}

/**
 * SCPI definite-length binary block read from the stream.
 *
 * @param bytes complete SCPI binary block
 */
record BinaryScpiTcpResponse(byte[] bytes) implements ScpiTcpResponse {

    BinaryScpiTcpResponse {
        bytes = Arrays.copyOf(bytes, bytes.length);
    }

    @Override
    public byte[] bytes() {
        return Arrays.copyOf(bytes, bytes.length);
    }
}


