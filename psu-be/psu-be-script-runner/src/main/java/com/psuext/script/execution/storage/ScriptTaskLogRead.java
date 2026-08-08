package com.psuext.script.execution.storage;

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
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.Objects;

/**
 * One open, bounded task-log read that streams directly from its backing reader.
 */
public final class ScriptTaskLogRead implements AutoCloseable {

    private final Reader reader;
    private final ScriptTaskLogRange range;

    ScriptTaskLogRead(Reader reader, ScriptTaskLogRange range) {
        this.reader = Objects.requireNonNull(reader, "reader must not be null");
        this.range = Objects.requireNonNull(range, "range must not be null");
    }

    /**
     * Copies the requested range to an output stream without retaining the full log in memory.
     *
     * @param output destination stream
     * @throws IOException when the source or destination cannot be read or written
     */
    public void writeTo(OutputStream output) throws IOException {
        Objects.requireNonNull(output, "output must not be null");
        skip(range.offset());
        char[] buffer = new char[4096];
        long remaining = range.limit() == null ? Long.MAX_VALUE : range.limit();
        int read;
        while (remaining > 0
                && (read = reader.read(buffer, 0, (int) Math.min(buffer.length, remaining))) >= 0) {
            output.write(new String(buffer, 0, read).getBytes(StandardCharsets.UTF_8));
            remaining -= read;
        }
    }

    @Override
    public void close() throws IOException {
        reader.close();
    }

    private void skip(long offset) throws IOException {
        long remaining = offset;
        while (remaining > 0) {
            long skipped = reader.skip(remaining);
            if (skipped > 0) {
                remaining -= skipped;
            } else if (reader.read() < 0) {
                return;
            } else {
                remaining--;
            }
        }
    }
}
