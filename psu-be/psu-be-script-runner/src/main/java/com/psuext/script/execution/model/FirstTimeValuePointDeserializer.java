package com.psuext.script.execution.model;

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

import java.io.IOException;
import java.util.List;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;

/** Deserializes at most the first point in a persisted series-point array. */
public final class FirstTimeValuePointDeserializer extends StdDeserializer<List<TimeValuePoint>> {

    /** Creates the bounded points deserializer. */
    public FirstTimeValuePointDeserializer() {
        super(List.class);
    }

    @Override
    public List<TimeValuePoint> deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        if (parser.currentToken() != JsonToken.START_ARRAY) {
            return List.of();
        }
        if (parser.nextToken() == JsonToken.END_ARRAY) {
            return List.of();
        }
        TimeValuePoint first = context.readValue(parser, TimeValuePoint.class);
        while (parser.nextToken() != JsonToken.END_ARRAY) {
            parser.skipChildren();
        }
        return List.of(first);
    }
}
