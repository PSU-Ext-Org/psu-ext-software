package com.psuext.script.execution.storage.file;

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
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.psuext.script.execution.model.TimeValuePoint;
import com.psuext.script.execution.storage.ScriptSeriesRange;
import com.psuext.script.execution.storage.ScriptTaskSeriesRead;

/** File-backed streaming read of one named series in a persisted task result. */
final class FileScriptTaskSeriesRead implements ScriptTaskSeriesRead {

    private final Path resultFile;
    private final String seriesName;
    private final ScriptSeriesRange range;
    private final ObjectMapper objectMapper;

    FileScriptTaskSeriesRead(Path resultFile, String seriesName, ScriptSeriesRange range, ObjectMapper objectMapper) {
        this.resultFile = resultFile;
        this.seriesName = seriesName;
        this.range = range;
        this.objectMapper = objectMapper;
    }

    @Override
    public void writeJsonTo(OutputStream output) throws IOException {
        try (JsonGenerator json = objectMapper.getFactory().createGenerator(output);
                JsonParser parser = objectMapper.getFactory().createParser(resultFile.toFile())) {
            json.writeStartObject();
            json.writeStringField("name", seriesName);
            writeSeries(parser, json);
            json.writeEndObject();
        }
    }

    @Override
    public void writeCsvTo(OutputStream output) throws IOException {
        try (JsonParser parser = objectMapper.getFactory().createParser(resultFile.toFile())) {
            writeSeries(parser, output);
        }
    }

    private void writeSeries(JsonParser parser, JsonGenerator output) throws IOException {
        require(parser.nextToken(), JsonToken.START_OBJECT);
        while (parser.nextToken() != JsonToken.END_OBJECT) {
            String rootField = parser.currentName();
            parser.nextToken();
            if (!"series".equals(rootField)) {
                parser.skipChildren();
                continue;
            }
            while (parser.nextToken() != JsonToken.END_ARRAY) {
                if (writeMatchingSeries(parser, output)) {
                    return;
                }
            }
            return;
        }
    }

    private void writeSeries(JsonParser parser, OutputStream output) throws IOException {
        require(parser.nextToken(), JsonToken.START_OBJECT);
        while (parser.nextToken() != JsonToken.END_OBJECT) {
            String rootField = parser.currentName();
            parser.nextToken();
            if (!"series".equals(rootField)) {
                parser.skipChildren();
                continue;
            }
            while (parser.nextToken() != JsonToken.END_ARRAY) {
                if (writeMatchingSeries(parser, output)) {
                    return;
                }
            }
            return;
        }
    }

    private boolean writeMatchingSeries(JsonParser parser, JsonGenerator output) throws IOException {
        String currentName = null;
        require(parser.currentToken(), JsonToken.START_OBJECT);
        while (parser.nextToken() != JsonToken.END_OBJECT) {
            String field = parser.currentName();
            parser.nextToken();
            if ("name".equals(field)) {
                currentName = parser.getValueAsString();
            } else if ("unit".equals(field) && seriesName.equals(currentName)) {
                output.writeObjectField("unit", parser.currentToken() == JsonToken.VALUE_NULL ? null : parser.getValueAsString());
            } else if ("metadata".equals(field) && seriesName.equals(currentName)) {
                output.writeObjectField("metadata", objectMapper.readValue(parser, new TypeReference<>() { }));
            } else if ("points".equals(field)) {
                if (seriesName.equals(currentName)) {
                    output.writeNumberField("offset", range.offset());
                    if (range.limit() != null) {
                        output.writeNumberField("limit", range.limit());
                    }
                    output.writeArrayFieldStart("points");
                    writePoints(parser, point -> output.writeObject(point));
                    output.writeEndArray();
                } else {
                    parser.skipChildren();
                }
            } else {
                parser.skipChildren();
            }
        }
        return seriesName.equals(currentName);
    }

    private boolean writeMatchingSeries(JsonParser parser, OutputStream output) throws IOException {
        String currentName = null;
        String unit = null;
        require(parser.currentToken(), JsonToken.START_OBJECT);
        while (parser.nextToken() != JsonToken.END_OBJECT) {
            String field = parser.currentName();
            parser.nextToken();
            if ("name".equals(field)) {
                currentName = parser.getValueAsString();
            } else if ("unit".equals(field) && seriesName.equals(currentName)) {
                unit = parser.currentToken() == JsonToken.VALUE_NULL ? null : parser.getValueAsString();
            } else if ("points".equals(field) && seriesName.equals(currentName)) {
                writeCsvRow(output, "name", currentName);
                writeCsvRow(output, "unit", unit == null ? "" : unit);
                output.write("timestamp,value\n".getBytes(StandardCharsets.UTF_8));
                writePoints(parser, point -> output.write((point.timestamp() + "," + point.value() + "\n")
                        .getBytes(StandardCharsets.UTF_8)));
            } else {
                parser.skipChildren();
            }
        }
        return seriesName.equals(currentName);
    }

    private void writePoints(JsonParser parser, PointWriter writer) throws IOException {
        require(parser.currentToken(), JsonToken.START_ARRAY);
        long index = 0;
        long written = 0;
        while (parser.nextToken() != JsonToken.END_ARRAY) {
            if (index++ < range.offset()) {
                parser.skipChildren();
                continue;
            }
            if (range.limit() != null && written >= range.limit()) {
                parser.skipChildren();
                continue;
            }
            writer.write(objectMapper.readValue(parser, TimeValuePoint.class));
            written++;
        }
    }

    private static void require(JsonToken actual, JsonToken expected) throws IOException {
        if (actual != expected) {
            throw new IOException("Expected JSON token " + expected + " but got " + actual);
        }
    }

    private static void writeCsvRow(OutputStream output, String key, String value) throws IOException {
        output.write((csv(value == null ? "" : key) + "," + csv(value) + "\n").getBytes(StandardCharsets.UTF_8));
    }

    private static String csv(String value) {
        return '"' + value.replace("\"", "\"\"") + '"';
    }

    @FunctionalInterface
    private interface PointWriter {
        void write(TimeValuePoint point) throws IOException;
    }
}
