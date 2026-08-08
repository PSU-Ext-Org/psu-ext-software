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

import com.psuext.transport.core.model.ScpiTransportResponse;
import org.springframework.stereotype.Component;

/**
 * Handles SCPI definite-length binary block TCP responses.
 */
@Component
final class BinaryScpiTcpResponseService implements ScpiTcpResponseService<BinaryScpiTcpResponse> {

    @Override
    public Class<BinaryScpiTcpResponse> responseType() {
        return BinaryScpiTcpResponse.class;
    }

    @Override
    public ScpiTransportResponse handle(BinaryScpiTcpResponse response, String delimiter) {
        return ScpiTransportResponse.binary(response.bytes());
    }
}


