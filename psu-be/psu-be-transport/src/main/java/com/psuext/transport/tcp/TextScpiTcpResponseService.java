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

import java.nio.charset.StandardCharsets;

import com.psuext.transport.core.model.ScpiTransportResponse;
import org.springframework.stereotype.Component;

/**
 * Handles text SCPI TCP responses.
 */
@Component
final class TextScpiTcpResponseService implements ScpiTcpResponseService<TextScpiTcpResponse> {

    @Override
    public Class<TextScpiTcpResponse> responseType() {
        return TextScpiTcpResponse.class;
    }

    @Override
    public ScpiTransportResponse handle(TextScpiTcpResponse response, String delimiter) {
        String value = new String(response.bytes(), StandardCharsets.UTF_8);
        if (!delimiter.isEmpty() && value.endsWith(delimiter)) {
            return ScpiTransportResponse.raw(value.substring(0, value.length() - delimiter.length()));
        }
        return ScpiTransportResponse.raw(value);
    }
}


