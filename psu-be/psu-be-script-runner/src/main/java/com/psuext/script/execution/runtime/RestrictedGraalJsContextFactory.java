package com.psuext.script.execution.runtime;

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

import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.HostAccess;

/**
 * Creates restricted GraalJS contexts for one script execution.
 */
public final class RestrictedGraalJsContextFactory {

    /**
     * Creates a context with host access, class lookup, IO, native access, and
     * thread creation disabled.
     *
     * @return a new restricted JavaScript context
     */
    public Context create() {
        return Context.newBuilder("js")
                .allowHostAccess(HostAccess.NONE)
                .allowHostClassLookup(name -> false)
                .allowAllAccess(false)
                .allowNativeAccess(false)
                .allowCreateThread(false)
                .allowAllAccess(false)
                .option("engine.WarnInterpreterOnly", "false")
                .build();
    }
}
