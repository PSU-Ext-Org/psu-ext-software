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

/** Supplies streamed JSON output for one captured series-point collection. */
@FunctionalInterface
public interface TimeValuePointStreamSource {

    /** Jackson writer attribute used by {@link StreamingTimeValuePointsSerializer}. */
    String ATTRIBUTE = TimeValuePointStreamSource.class.getName();

    /** Writes the complete point array for the supplied in-memory preview collection. */
    void writePoints(List<TimeValuePoint> previewPoints, JsonGenerator generator) throws IOException;
}
