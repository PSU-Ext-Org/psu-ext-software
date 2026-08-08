package com.psuext.script.web.execution.script;

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

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Base64;

import com.psuext.script.web.execution.script.support.ScriptControllerTestSupport;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/** Running-server coverage for the {@code queryBinary(...)} script binding. */
class ScriptBinaryQueryBindingsControllerTest extends ScriptControllerTestSupport {

    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry registry) {
        registerStorage(registry, "script-binary-query-bindings-controller");
    }

    @Test
    void parsesAndLogsEveryFirmwareMeasurementDataRecord() {
        byte[] block = firmwareMeasurementDataBlock();
        server.respondBinaryTo("MEAS:VOLT:DATA? CH1", block);
        connect(DEVICE_NAME);
        awaitConnected();

        String taskId = submitAndAwaitCompleted(
                "binary-query",
                """
                        const encodedBlock = queryBinary('PSU1', 'MEAS:VOLT:DATA? CH1');
                        const bytes = decodeBase64(encodedBlock);
                        const digitCount = bytes[1] - 0x30;
                        const payloadOffset = 2 + digitCount;
                        const payloadLength = decimalValue(bytes, 2, payloadOffset);
                        if (bytes[0] !== 0x23 || payloadLength !== bytes.length - payloadOffset
                                || payloadLength % 8 !== 0) {
                          throw new Error('Invalid measurement DATA block');
                        }
                        for (let offset = payloadOffset; offset < bytes.length; offset += 8) {
                          const timeMs = uint32LittleEndian(bytes, offset);
                          const valueU4 = uint32LittleEndian(bytes, offset + 4);
                          log('INFO', 'timeMs=' + timeMs + ' valueU4=' + valueU4);
                        }
                        return encodedBlock;

                        function decodeBase64(value) {
                          const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                          const result = [];
                          let accumulator = 0;
                          let bitCount = 0;
                          for (const character of value) {
                            if (character === '=') {
                              break;
                            }
                            const sextet = alphabet.indexOf(character);
                            if (sextet < 0) {
                              throw new Error('Invalid base64 DATA block');
                            }
                            accumulator = (accumulator << 6) | sextet;
                            bitCount += 6;
                            while (bitCount >= 8) {
                              bitCount -= 8;
                              result.push((accumulator >> bitCount) & 0xff);
                            }
                          }
                          return result;
                        }

                        function decimalValue(bytes, start, end) {
                          let value = 0;
                          for (let index = start; index < end; index += 1) {
                            value = value * 10 + bytes[index] - 0x30;
                          }
                          return value;
                        }

                        function uint32LittleEndian(bytes, offset) {
                          return bytes[offset]
                              | (bytes[offset + 1] << 8)
                              | (bytes[offset + 2] << 16)
                              | (bytes[offset + 3] << 24);
                        }
                        """);

        assertThat(get("/api/scripts/" + taskId + "/result"))
                .contains("\"returnValue\":\"" + Base64.getEncoder().encodeToString(block) + "\"");

        assertThat(get("/api/scripts/" + taskId + "/log"))
                .contains("timeMs=1000 valueU4=120000")
                .contains("timeMs=1100 valueU4=120125")
                .contains("timeMs=1200 valueU4=119980");
    }

    @Test
    void reportsScpiErrorWhenBinaryQueryReturnsText() {
        server.respondTo("MEAS:VOLT:DATA? CH1", "not binary");
        connect(DEVICE_NAME);
        awaitConnected();

        String taskId = submit("binary-query-text", "queryBinary('PSU1', 'MEAS:VOLT:DATA? CH1');");

        awaitState(taskId, "FAILED");
        assertThat(get("/api/scripts/" + taskId + "/result"))
                .contains("\"code\":\"UNEXPECTED_TEXT_RESPONSE\"")
                .contains("\"source\":\"SCPI\"");
    }

    private static byte[] firmwareMeasurementDataBlock() {
        return new byte[] {
                '#', '2', '2', '4',
                (byte) 0xE8, 0x03, 0x00, 0x00, (byte) 0xC0, (byte) 0xD4, 0x01, 0x00,
                0x4C, 0x04, 0x00, 0x00, 0x3D, (byte) 0xD5, 0x01, 0x00,
                (byte) 0xB0, 0x04, 0x00, 0x00, (byte) 0xAC, (byte) 0xD4, 0x01, 0x00};
    }
}
