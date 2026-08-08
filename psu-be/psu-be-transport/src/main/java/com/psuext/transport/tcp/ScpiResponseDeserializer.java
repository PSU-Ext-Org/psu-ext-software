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

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import org.jspecify.annotations.NullMarked;
import org.jspecify.annotations.Nullable;
import org.springframework.core.serializer.Deserializer;

/**
 * Deserializes one PSU-EXT SCPI response from a TCP stream.
 *
 * <p>Text responses are read through the configured response delimiter. SCPI
 * definite-length binary blocks are detected by their {@code #<n><length>}
 * header and returned without requiring a trailing delimiter.
 */
@NullMarked
public final class ScpiResponseDeserializer implements Deserializer<ScpiTcpResponse> {

    private final byte[] delimiter;

    public ScpiResponseDeserializer(@Nullable String delimiter) {
        this.delimiter = delimiter == null || delimiter.isEmpty()
                ? new byte[0]
                : delimiter.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public ScpiTcpResponse deserialize(InputStream inputStream) throws IOException {
        int first = inputStream.read();
        if (first < 0) {
            throw new IOException("No SCPI response bytes available");
        }
        if (first == '#') {
            return new BinaryScpiTcpResponse(readDefiniteLengthBlock(inputStream));
        }
        return new TextScpiTcpResponse(readDelimitedText(inputStream, first));
    }

    private byte[] readDefiniteLengthBlock(InputStream inputStream) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        output.write('#');

        int digitCountByte = readRequired(inputStream);
        output.write(digitCountByte);
        if (digitCountByte < '1' || digitCountByte > '9') {
            throw new IOException("Unsupported SCPI binary block header");
        }

        int digitCount = digitCountByte - '0';
        byte[] lengthBytes = inputStream.readNBytes(digitCount);
        if (lengthBytes.length != digitCount) {
            throw new IOException("Incomplete SCPI binary block length");
        }
        output.writeBytes(lengthBytes);

        int payloadLength = parsePayloadLength(lengthBytes);
        byte[] payload = inputStream.readNBytes(payloadLength);
        if (payload.length != payloadLength) {
            throw new IOException("Incomplete SCPI binary block payload");
        }
        output.writeBytes(payload);
        return output.toByteArray();
    }

    private byte[] readDelimitedText(InputStream inputStream, int first) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        output.write(first);
        if (delimiter.length == 0) {
            return output.toByteArray();
        }
        while (!endsWith(output, delimiter)) {
            output.write(readRequired(inputStream));
        }
        return output.toByteArray();
    }

    private int parsePayloadLength(byte[] lengthBytes) throws IOException {
        int length = 0;
        for (byte value : lengthBytes) {
            if (value < '0' || value > '9') {
                throw new IOException("Invalid SCPI binary block length");
            }
            try {
                length = Math.addExact(Math.multiplyExact(length, 10), value - '0');
            } catch (ArithmeticException ex) {
                throw new IOException("SCPI binary block length is too large", ex);
            }
        }
        return length;
    }

    private int readRequired(InputStream inputStream) throws IOException {
        int value = inputStream.read();
        if (value < 0) {
            throw new IOException("Incomplete SCPI response");
        }
        return value;
    }

    private boolean endsWith(ByteArrayOutputStream output, byte[] suffix) {
        byte[] bytes = output.toByteArray();
        if (bytes.length < suffix.length) {
            return false;
        }
        return Arrays.equals(
                Arrays.copyOfRange(bytes, bytes.length - suffix.length, bytes.length),
                suffix);
    }
}


