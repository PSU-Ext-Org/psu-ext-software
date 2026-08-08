package com.psuext.script.management.builtin;

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

import com.fasterxml.jackson.databind.ObjectMapper;
import com.psuext.script.management.api.ScriptCatalogue;
import com.psuext.script.management.api.ScriptCatalogueOperation;
import com.psuext.script.management.api.UnsupportedCatalogueOperationException;
import com.psuext.script.management.model.CreateScriptRequest;
import com.psuext.script.management.model.ScriptDefinition;
import com.psuext.script.management.model.ScriptDefinitionId;
import com.psuext.script.management.model.ScriptDefinitionOrigin;
import com.psuext.script.management.model.ScriptDefinitionPage;
import com.psuext.script.management.model.ScriptDefinitionQuery;
import com.psuext.script.management.model.UpdateScriptRequest;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.ResourcePatternResolver;
import org.springframework.util.unit.DataSize;

/**
 * Immutable catalogue loaded and validated from packaged builtin JavaScript resources.
 *
 * <p>The constructor validates the manifest/resource pairs eagerly. A malformed package therefore prevents
 * application startup rather than exposing a partial builtin namespace at request time. Returned definitions
 * are held in an immutable map for the process lifetime.</p>
 */
public final class ClasspathBuiltinScriptCatalogue implements ScriptCatalogue {

    private static final Logger LOGGER = LoggerFactory.getLogger(ClasspathBuiltinScriptCatalogue.class);
    private static final String DIRECTORY = "scripts/builtin/";
    private static final String MANIFEST = DIRECTORY + "catalogue.json";

    private final Map<ScriptDefinitionId, ScriptDefinition> definitions;

    /**
     * Loads all builtin definitions immediately so a broken application package fails during startup.
     *
     * @param resourcePatternResolver resolver for direct classpath resources
     * @param objectMapper mapper for the builtin metadata manifest
     * @param maximumSourceCodeSize maximum allowed UTF-8 script size
     */
    public ClasspathBuiltinScriptCatalogue(
            ResourcePatternResolver resourcePatternResolver,
            ObjectMapper objectMapper,
            DataSize maximumSourceCodeSize) {
        if (resourcePatternResolver == null || objectMapper == null || maximumSourceCodeSize == null
                || maximumSourceCodeSize.toBytes() <= 0) {
            throw new IllegalArgumentException(
                    "resolver, objectMapper, and a positive maximumSourceCodeSize are required");
        }
        this.definitions = Map.copyOf(load(resourcePatternResolver, objectMapper, maximumSourceCodeSize.toBytes()));
        LOGGER.info("Builtin script catalogue loaded: definitionCount={}", definitions.size());
    }

    /**
     * {@inheritDoc}
     *
     * <p>Builtins retain optional display positions from their packaged manifest. Clients may use that metadata to
     * control presentation; definitions without positions remain valid.</p>
     */
    @Override
    public ScriptDefinitionPage list(ScriptDefinitionQuery query) {
        var matching = definitions.values().stream()
                .filter(definition -> matches(definition, query))
                .sorted(Comparator.comparing(ScriptDefinition::position,
                        Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(definition -> definition.id().value()))
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

    /** {@inheritDoc} Builtin resources are immutable and cannot be created at runtime. */
    @Override
    public ScriptDefinition create(CreateScriptRequest request) {
        throw unsupported(ScriptCatalogueOperation.CREATE);
    }

    /** {@inheritDoc} Builtin resources are immutable and cannot be replaced at runtime. */
    @Override
    public ScriptDefinition replace(ScriptDefinitionId id, UpdateScriptRequest request) {
        throw unsupported(ScriptCatalogueOperation.REPLACE);
    }

    /** {@inheritDoc} Builtin resources are immutable and cannot be deleted at runtime. */
    @Override
    public boolean delete(ScriptDefinitionId id) {
        throw unsupported(ScriptCatalogueOperation.DELETE);
    }

    private static Map<ScriptDefinitionId, ScriptDefinition> load(
            ResourcePatternResolver resolver, ObjectMapper objectMapper, long maximumSourceCodeBytes) {
        try {
            var manifestResource = resolver.getResource("classpath:" + MANIFEST);
            if (!manifestResource.exists()) {
                throw new IllegalStateException("builtin script catalogue manifest is missing");
            }
            BuiltinManifest manifest;
            try (var manifestStream = manifestResource.getInputStream()) {
                manifest = objectMapper.readValue(manifestStream, BuiltinManifest.class);
            }
            if (manifest.scripts() == null) {
                throw new IllegalStateException("builtin script catalogue manifest has no scripts");
            }
            var resources = indexedResources(resolver.getResources("classpath*:" + DIRECTORY + "*.js"));
            var definitions = new HashMap<ScriptDefinitionId, ScriptDefinition>();
            for (BuiltinManifestEntry entry : manifest.scripts()) {
                var id = new ScriptDefinitionId(entry.id());
                if (definitions.containsKey(id)) {
                    throw new IllegalStateException("builtin script catalogue contains duplicate ID " + id.value());
                }
                var resource = resources.remove(id.value());
                if (resource == null) {
                    throw new IllegalStateException("builtin script resource is missing for " + id.value());
                }
                String source;
                try (var sourceStream = resource.getInputStream()) {
                    source = new String(sourceStream.readAllBytes(), StandardCharsets.UTF_8);
                }
                if (source.getBytes(StandardCharsets.UTF_8).length > maximumSourceCodeBytes) {
                    throw new IllegalStateException("builtin script exceeds the configured maximum source size");
                }
                definitions.put(id, new ScriptDefinition(id, entry.name(), source, entry.tags(),
                        ScriptDefinitionOrigin.BUILTIN, Instant.EPOCH, Instant.EPOCH, entry.position()));
            }
            if (!resources.isEmpty()) {
                throw new IllegalStateException("builtin script resource has no manifest entry: " + resources.keySet());
            }
            return definitions;
        } catch (IOException | IllegalArgumentException exception) {
            LOGGER.error("Builtin script catalogue load failed: error={}",
                    exception.getClass().getSimpleName(), exception);
            throw new IllegalStateException("could not load builtin script catalogue", exception);
        } catch (IllegalStateException exception) {
            LOGGER.error("Builtin script catalogue load failed: error={}",
                    exception.getClass().getSimpleName(), exception);
            throw exception;
        }
    }

    private static Map<String, Resource> indexedResources(Resource[] resources) {
        var indexed = new HashMap<String, Resource>();
        for (Resource resource : resources) {
            var filename = resource.getFilename();
            if (filename == null || !filename.endsWith(".js")) {
                throw new IllegalStateException("invalid builtin script resource name");
            }
            var id = new ScriptDefinitionId(filename.substring(0, filename.length() - 3));
            if (indexed.put(id.value(), resource) != null) {
                throw new IllegalStateException("duplicate builtin script resource " + id.value());
            }
        }
        return indexed;
    }

    private static boolean matches(ScriptDefinition definition, ScriptDefinitionQuery query) {
        var nameMatches = query.name() == null
                || definition.name().toLowerCase(Locale.ROOT).contains(query.name().toLowerCase(Locale.ROOT));
        return nameMatches && (query.tags().isEmpty() || query.tags().stream().anyMatch(definition.tags()::contains));
    }

    private static UnsupportedCatalogueOperationException unsupported(ScriptCatalogueOperation operation) {
        return new UnsupportedCatalogueOperationException(operation, ScriptDefinitionOrigin.BUILTIN);
    }

    private record BuiltinManifest(List<BuiltinManifestEntry> scripts) {
    }

    private record BuiltinManifestEntry(String id, String name, List<String> tags, Integer position) {
    }

}
