package com.psuext.script.management.support;

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

import com.psuext.script.management.api.ScriptCatalogue;
import com.psuext.script.management.model.CreateScriptRequest;
import com.psuext.script.management.model.ScriptDefinition;
import com.psuext.script.management.model.ScriptDefinitionId;
import com.psuext.script.management.model.ScriptDefinitionOrigin;
import com.psuext.script.management.model.ScriptDefinitionPage;
import com.psuext.script.management.model.ScriptDefinitionQuery;
import com.psuext.script.management.model.UpdateScriptRequest;
import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Resettable in-memory catalogue for Spring wiring and HTTP tests.
 *
 * <p>The test fixture keeps no filesystem state and is explicitly cleared before and after every test that uses
 * it. It provides enough mutable catalogue behavior for a replacement bean to be exercised at the same boundary
 * as production code.</p>
 */
public final class InMemoryScriptCatalogue implements ScriptCatalogue {

    private final Map<ScriptDefinitionId, ScriptDefinition> definitions = new LinkedHashMap<>();
    private final ScriptDefinitionOrigin origin;
    private int nextId;

    /** Creates a mutable test catalogue with user-owned definitions. */
    public InMemoryScriptCatalogue() {
        this(ScriptDefinitionOrigin.USER);
    }

    /** @param origin origin assigned to test-created definitions */
    public InMemoryScriptCatalogue(ScriptDefinitionOrigin origin) {
        this.origin = origin;
    }

    /** Removes all definitions and resets deterministic generated IDs. */
    public void clear() {
        definitions.clear();
        nextId = 0;
    }

    /** @param definition complete immutable definition to expose from this test catalogue */
    public void put(ScriptDefinition definition) {
        definitions.put(definition.id(), definition);
    }

    /** {@inheritDoc} */
    @Override
    public ScriptDefinitionPage list(ScriptDefinitionQuery query) {
        var matching = definitions.values().stream()
                .filter(definition -> matches(definition, query))
                .sorted(Comparator.comparing(definition -> definition.id().value()))
                .toList();
        var from = Math.min(query.offset(), matching.size());
        var to = Math.min(from + query.limit(), matching.size());
        return new ScriptDefinitionPage(matching.subList(from, to), query.limit(), query.offset(), matching.size());
    }

    /** {@inheritDoc} */
    @Override
    public Optional<ScriptDefinition> find(ScriptDefinitionId id) {
        return Optional.ofNullable(definitions.get(id));
    }

    /** {@inheritDoc} */
    @Override
    public ScriptDefinition create(CreateScriptRequest request) {
        var now = Instant.now();
        var definition = new ScriptDefinition(new ScriptDefinitionId("test-" + ++nextId), request.name(),
                request.sourceCode(), request.tags(), origin, now, now);
        definitions.put(definition.id(), definition);
        return definition;
    }

    /** {@inheritDoc} */
    @Override
    public ScriptDefinition replace(ScriptDefinitionId id, UpdateScriptRequest request) {
        var existing = definitions.get(id);
        if (existing == null) {
            throw new IllegalArgumentException("script definition does not exist");
        }
        var replacement = new ScriptDefinition(id, request.name(), request.sourceCode(), request.tags(),
                origin, existing.createdAt(), Instant.now());
        definitions.put(id, replacement);
        return replacement;
    }

    /** {@inheritDoc} */
    @Override
    public boolean delete(ScriptDefinitionId id) {
        return definitions.remove(id) != null;
    }

    private static boolean matches(ScriptDefinition definition, ScriptDefinitionQuery query) {
        var nameMatches = query.name() == null
                || definition.name().toLowerCase(Locale.ROOT).contains(query.name().toLowerCase(Locale.ROOT));
        return nameMatches && (query.tags().isEmpty() || query.tags().stream().anyMatch(definition.tags()::contains));
    }
}
