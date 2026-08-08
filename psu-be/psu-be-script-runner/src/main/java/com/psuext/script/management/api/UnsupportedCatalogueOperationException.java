package com.psuext.script.management.api;

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

import com.psuext.script.management.model.ScriptDefinitionOrigin;
import java.util.Objects;

/**
 * Reports an operation that a catalogue origin intentionally does not support.
 *
 * <p>The operation and origin are exposed as stable domain values so a web adapter can translate the
 * failure without inspecting an implementation-specific message.</p>
 */
public final class UnsupportedCatalogueOperationException extends UnsupportedOperationException {

    private final ScriptCatalogueOperation operation;
    private final ScriptDefinitionOrigin origin;

    /**
     * @param operation rejected operation
     * @param origin immutable or mutable target origin
     */
    public UnsupportedCatalogueOperationException(
            ScriptCatalogueOperation operation, ScriptDefinitionOrigin origin) {
        super(Objects.requireNonNull(operation, "operation must not be null")
                + " is not supported for " + Objects.requireNonNull(origin, "origin must not be null"));
        this.operation = operation;
        this.origin = origin;
    }

    /** @return rejected mutation operation */
    public ScriptCatalogueOperation operation() {
        return operation;
    }

    /** @return immutable or mutable catalogue origin that rejected the operation */
    public ScriptDefinitionOrigin origin() {
        return origin;
    }
}
