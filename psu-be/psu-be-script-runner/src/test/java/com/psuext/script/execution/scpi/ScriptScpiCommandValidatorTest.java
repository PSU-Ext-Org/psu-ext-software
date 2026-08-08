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

import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

import org.junit.jupiter.api.Test;

class ScriptScpiCommandValidatorTest {

    @Test
    void queryRequiresQuestionMarkInFirstHeader() {
        ScriptScpiCommandValidator.requireQuery("MEAS:VOLT?");

        assertThatExceptionOfType(ScriptScpiException.class)
                .isThrownBy(() -> ScriptScpiCommandValidator.requireQuery("MEAS:VOLT"))
                .satisfies(error -> assertCode(error, "INVALID_QUERY_COMMAND"));
    }

    @Test
    void writeRejectsQuestionMarkInFirstHeader() {
        ScriptScpiCommandValidator.requireWrite("OUTP ON");

        assertThatExceptionOfType(ScriptScpiException.class)
                .isThrownBy(() -> ScriptScpiCommandValidator.requireWrite("SYST:TEXT? ON"))
                .satisfies(error -> assertCode(error, "INVALID_WRITE_COMMAND"));
    }

    @Test
    void commandsRejectTrailingLineEnding() {
        assertThatExceptionOfType(ScriptScpiException.class)
                .isThrownBy(() -> ScriptScpiCommandValidator.requireQuery("*IDN?\n"))
                .satisfies(error -> assertCode(error, "INVALID_COMMAND"));
    }

    private static void assertCode(Throwable error, String code) {
        ScriptScpiException scpiException = (ScriptScpiException) error;
        org.assertj.core.api.Assertions.assertThat(scpiException.code()).isEqualTo(code);
    }
}
