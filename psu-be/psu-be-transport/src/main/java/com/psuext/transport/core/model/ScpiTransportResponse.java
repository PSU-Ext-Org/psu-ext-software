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

import java.util.Arrays;

/**
 * Result returned by a SCPI transport operation.
 */
public sealed interface ScpiTransportResponse permits
        ScpiTransportResponse.Control,
        ScpiTransportResponse.Text,
        ScpiTransportResponse.Binary,
        ScpiTransportResponse.Error {

    /**
     * Creates a successful control response.
     *
     * @param message response message without the {@code OK} prefix
     * @return successful transport response
     */
    static ScpiTransportResponse ok(String message) {
        return new Control(message);
    }

    /**
     * Creates a successful raw SCPI text response.
     *
     * @param rawResponse raw command reply
     * @return successful transport response carrying raw SCPI text
     */
    static ScpiTransportResponse raw(String rawResponse) {
        return new Text(rawResponse);
    }

    /**
     * Creates a successful raw SCPI binary response.
     *
     * @param binaryResponse complete SCPI binary block, including the definite-length header
     * @return successful transport response carrying raw SCPI binary data
     */
    static ScpiTransportResponse binary(byte[] binaryResponse) {
        return new Binary(binaryResponse);
    }

    /**
     * Creates a structured error response.
     *
     * @param code stable error code
     * @param message human-readable error detail
     * @return failed transport response
     */
    static ScpiTransportResponse error(String code, String message) {
        return new Error(code, message);
    }

    /**
     * Returns whether the operation succeeded.
     *
     * @return whether the operation succeeded
     */
    boolean ok();

    /**
     * Returns the control or error message when this response has one.
     *
     * @return message, or {@code null} for raw data responses
     */
    default String message() {
        return null;
    }

    /**
     * Returns the stable error code when this response is an error.
     *
     * @return error code, or {@code null} for successful responses
     */
    default String code() {
        return null;
    }

    /**
     * Successful control response.
     *
     * @param message human-readable control message
     */
    record Control(String message) implements ScpiTransportResponse {

        @Override
        public boolean ok() {
            return true;
        }

        @Override
        public String message() {
            return message;
        }

    }

    /**
     * Successful raw SCPI text response.
     *
     * @param rawResponse raw SCPI text
     */
    record Text(String rawResponse) implements ScpiTransportResponse {

        @Override
        public boolean ok() {
            return true;
        }

    }

    /**
     * Successful raw SCPI binary block response.
     *
     * @param binaryResponse complete SCPI binary block
     */
    record Binary(byte[] binaryResponse) implements ScpiTransportResponse {

        public Binary {
            binaryResponse = Arrays.copyOf(binaryResponse, binaryResponse.length);
        }

        @Override
        public boolean ok() {
            return true;
        }

        @Override
        public byte[] binaryResponse() {
            return Arrays.copyOf(binaryResponse, binaryResponse.length);
        }
    }

    /**
     * Structured transport error response.
     *
     * @param code stable error code
     * @param message human-readable error detail
     */
    record Error(String code, String message) implements ScpiTransportResponse {

        @Override
        public boolean ok() {
            return false;
        }

        @Override
        public String message() {
            return message;
        }

        @Override
        public String code() {
            return code;
        }

    }
}


