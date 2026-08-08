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

import com.psuext.connection.device.DeviceConnectionException;
import org.springframework.stereotype.Component;

/**
 * Parses PSU-EXT binary DATA query replies into payload frames.
 */
@Component
public class BinaryDataFrameParser implements TypedScpiDataParser {

    @Override
    public boolean supports(String command) {
        return command != null && command.toUpperCase().contains(":DATA?");
    }

    @Override
    public TypedScpiData parse(String command, byte[] binaryBlock) {
        if (binaryBlock.length < 3 || binaryBlock[0] != '#') {
            throw new DeviceConnectionException("BAD_DATA_BLOCK", "Response is not a SCPI definite-length binary block");
        }
        int digits = binaryBlock[1] - '0';
        if (digits < 1 || digits > 9 || binaryBlock.length < 2 + digits) {
            throw new DeviceConnectionException("BAD_DATA_BLOCK", "SCPI binary block header is invalid");
        }
        int payloadOffset = 2 + digits;
        int payloadLength = 0;
        for (int i = 0; i < digits; i++) {
            byte value = binaryBlock[2 + i];
            if (value < '0' || value > '9') {
                throw new DeviceConnectionException("BAD_DATA_BLOCK", "SCPI binary block length is invalid");
            }
            payloadLength = Math.addExact(Math.multiplyExact(payloadLength, 10), value - '0');
        }
        if (binaryBlock.length != payloadOffset + payloadLength) {
            throw new DeviceConnectionException("BAD_DATA_BLOCK", "SCPI binary block payload length does not match header");
        }
        byte[] payload = new byte[payloadLength];
        System.arraycopy(binaryBlock, payloadOffset, payload, 0, payloadLength);
        return new BinaryDataFrame(command, payload);
    }
}


