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

/** Streams one bounded task result series without materializing its points. */
public interface ScriptTaskSeriesRead {

    /** Writes the requested series range as a JSON response. */
    void writeJsonTo(OutputStream output) throws IOException;

    /** Writes the requested series range as UTF-8 CSV rows. */
    void writeCsvTo(OutputStream output) throws IOException;
}
