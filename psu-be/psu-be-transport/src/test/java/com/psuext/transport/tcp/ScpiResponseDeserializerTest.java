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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayInputStream;

import org.junit.jupiter.api.Test;

class ScpiResponseDeserializerTest {

    @Test
    void readsTextResponseThroughDelimiter() throws Exception {
        ScpiResponseDeserializer deserializer = new ScpiResponseDeserializer("\n");

        ScpiTcpResponse response = deserializer.deserialize(new ByteArrayInputStream("OK\n".getBytes()));

        assertThat(response)
                .isInstanceOfSatisfying(
                        TextScpiTcpResponse.class,
                        text -> assertThat(text.bytes()).isEqualTo("OK\n".getBytes()));
    }

    @Test
    void readsBinaryDefiniteLengthBlock() throws Exception {
        ScpiResponseDeserializer deserializer = new ScpiResponseDeserializer("\n");
        byte[] binaryBlock = new byte[] {'#', '2', '0', '8', 0, 1, 2, 3, 4, 5, 6, 7};

        ScpiTcpResponse response = deserializer.deserialize(new ByteArrayInputStream(binaryBlock));

        assertThat(response)
                .isInstanceOfSatisfying(
                        BinaryScpiTcpResponse.class,
                        binary -> assertThat(binary.bytes()).isEqualTo(binaryBlock));
    }

    @Test
    void readsEmptyBinaryDefiniteLengthBlock() throws Exception {
        ScpiResponseDeserializer deserializer = new ScpiResponseDeserializer("\n");
        byte[] binaryBlock = new byte[] {'#', '1', '0'};

        ScpiTcpResponse response = deserializer.deserialize(new ByteArrayInputStream(binaryBlock));

        assertThat(response)
                .isInstanceOfSatisfying(
                        BinaryScpiTcpResponse.class,
                        binary -> assertThat(binary.bytes()).isEqualTo(binaryBlock));
    }

    @Test
    void rejectsUnsupportedBinaryHeader() {
        ScpiResponseDeserializer deserializer = new ScpiResponseDeserializer("\n");

        assertThatThrownBy(() -> deserializer.deserialize(new ByteArrayInputStream(new byte[] {'#', '0'})))
                .isInstanceOf(java.io.IOException.class)
                .hasMessage("Unsupported SCPI binary block header");
    }

    @Test
    void rejectsIncompleteBinaryPayload() {
        ScpiResponseDeserializer deserializer = new ScpiResponseDeserializer("\n");

        assertThatThrownBy(() -> deserializer.deserialize(new ByteArrayInputStream(new byte[] {'#', '1', '4', 1, 2})))
                .isInstanceOf(java.io.IOException.class)
                .hasMessage("Incomplete SCPI binary block payload");
    }

    @Test
    void rejectsInvalidBinaryLength() {
        ScpiResponseDeserializer deserializer = new ScpiResponseDeserializer("\n");

        assertThatThrownBy(() -> deserializer.deserialize(new ByteArrayInputStream(new byte[] {'#', '1', 'A'})))
                .isInstanceOf(java.io.IOException.class)
                .hasMessage("Invalid SCPI binary block length");
    }
}
