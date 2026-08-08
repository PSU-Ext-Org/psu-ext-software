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

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;

/**
 * Named numeric series extracted from script records.
 *
 * @param name series name
 * @param unit engineering unit, or {@code null} when unspecified
 * @param points immutable sampled points
 * @param metadata JSON-compatible series metadata
 */
public record TimeValueSeries(
        String name,
        String unit,
        @JsonSerialize(using = StreamingTimeValuePointsSerializer.class)
        @JsonDeserialize(using = FirstTimeValuePointDeserializer.class)
        List<TimeValuePoint> points,
        Map<String, Object> metadata
) {

    public TimeValueSeries {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("name must not be blank");
        }
        name = name.trim();
        points = points == null ? List.of() : List.copyOf(points);
        metadata = metadata == null ? Map.of() : Map.copyOf(metadata);
    }
}
