package com.psuext.proxy.ws;

/*-
 * #%L
 * PSU-BE Proxy
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

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Builds WebSocket protocol command dispatch structures from Spring-managed
 * command beans.
 */
@Configuration
class ScpiWebSocketCommandConfig {

    /**
     * Creates the dispatch map keyed by each command's protocol token.
     *
     * @param commands discovered WebSocket protocol command beans
     * @return immutable command-key dispatch map
     */
    @Bean
    Map<String, ScpiWebSocketCommand> scpiWebSocketCommandMap(List<ScpiWebSocketCommand> commands) {
        return commands.stream()
                .collect(Collectors.toUnmodifiableMap(
                        command -> command.command().toLowerCase(Locale.ROOT),
                        Function.identity(),
                        this::duplicateCommand));
    }

    private ScpiWebSocketCommand duplicateCommand(
            ScpiWebSocketCommand first,
            ScpiWebSocketCommand second) {
        throw new IllegalStateException("Duplicate WebSocket command: " + first.command());
    }
}
