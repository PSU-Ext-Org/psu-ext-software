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

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.ser.std.StdSerializer;

/** Serializes series points from a configured streaming source when one is available. */
public final class StreamingTimeValuePointsSerializer extends StdSerializer<List<TimeValuePoint>> {

    /** Creates the points serializer. */
    public StreamingTimeValuePointsSerializer() {
        super((Class<List<TimeValuePoint>>) (Class<?>) List.class);
    }

    @Override
    public void serialize(List<TimeValuePoint> points, JsonGenerator generator, SerializerProvider provider) throws IOException {
        Object attribute = provider.getAttribute(TimeValuePointStreamSource.ATTRIBUTE);
        if (attribute instanceof TimeValuePointStreamSource source) {
            source.writePoints(points, generator);
            return;
        }
        generator.writeStartArray();
        for (TimeValuePoint point : points) {
            generator.writeObject(point);
        }
        generator.writeEndArray();
    }
}
