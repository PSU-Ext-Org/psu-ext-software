package com.psuext.script.management.file;

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
import com.psuext.script.management.api.ScriptDefinitionIdConflictException;
import com.psuext.script.management.model.CreateScriptRequest;
import com.psuext.script.management.model.ScriptDefinition;
import com.psuext.script.management.model.ScriptDefinitionId;
import com.psuext.script.management.model.ScriptDefinitionOrigin;
import com.psuext.script.management.model.ScriptDefinitionPage;
import com.psuext.script.management.model.ScriptDefinitionQuery;
import com.psuext.script.management.model.UpdateScriptRequest;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.unit.DataSize;

/**
 * File-backed user catalogue that atomically publishes complete per-definition directories.
 *
 * <p>Each definition is persisted as {@code definition.json} plus {@code source.js} below a validated
 * identifier directory. Writers publish a complete temporary directory and readers are guarded by a
 * process-local read/write lock, preventing this process from observing half-published state. Incomplete or
 * corrupt directories are skipped only by list operations; direct reads and mutations fail safely.</p>
 */
public final class FileUserScriptCatalogue implements ScriptCatalogue {

    private static final Logger LOGGER = LoggerFactory.getLogger(FileUserScriptCatalogue.class);
    private static final String DEFINITION_FILE = "definition.json";
    private static final String SOURCE_FILE = "source.js";

    private final Path root;
    private final ObjectMapper objectMapper;
    private final long maximumSourceCodeBytes;
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();

    /**
     * @param userDirectory configured user-script root; it is converted to an absolute normalized path
     * @param objectMapper mapper used only by this persistence adapter and expected to support {@link Instant}
     * @param maximumSourceCodeSize maximum allowed UTF-8 source size enforced before any files are published
     */
    public FileUserScriptCatalogue(Path userDirectory, ObjectMapper objectMapper, DataSize maximumSourceCodeSize) {
        if (userDirectory == null || userDirectory.toString().isBlank()) {
            throw new IllegalArgumentException("userDirectory must not be blank");
        }
        if (objectMapper == null || maximumSourceCodeSize == null || maximumSourceCodeSize.toBytes() <= 0) {
            throw new IllegalArgumentException("objectMapper and a positive maximumSourceCodeSize are required");
        }
        this.root = userDirectory.toAbsolutePath().normalize();
        this.objectMapper = objectMapper;
        this.maximumSourceCodeBytes = maximumSourceCodeSize.toBytes();
    }

    /** {@inheritDoc} */
    @Override
    public ScriptDefinitionPage list(ScriptDefinitionQuery query) {
        lock.readLock().lock();
        try {
            var definitions = readCompleteDefinitions().stream()
                    .filter(definition -> matches(definition, query))
                    .sorted(Comparator.comparing(ScriptDefinition::updatedAt).reversed()
                            .thenComparing(definition -> definition.id().value()))
                    .toList();
            var from = Math.min(query.offset(), definitions.size());
            var to = Math.min(from + query.limit(), definitions.size());
            return new ScriptDefinitionPage(
                    definitions.subList(from, to), query.limit(), query.offset(), definitions.size());
        } catch (ScriptDefinitionStorageException exception) {
            logStorageFailure("list", null, exception);
            throw exception;
        } finally {
            lock.readLock().unlock();
        }
    }

    /** {@inheritDoc} */
    @Override
    public Optional<ScriptDefinition> find(ScriptDefinitionId id) {
        lock.readLock().lock();
        try {
            var directory = definitionDirectory(id);
            return Files.exists(directory) ? Optional.of(readDefinition(directory, id)) : Optional.empty();
        } catch (ScriptDefinitionStorageException exception) {
            logStorageFailure("find", id, exception);
            throw exception;
        } finally {
            lock.readLock().unlock();
        }
    }

    /** {@inheritDoc} */
    @Override
    public ScriptDefinition create(CreateScriptRequest request) {
        lock.writeLock().lock();
        try {
            ensureRootExists();
            for (int attempt = 0; attempt < 3; attempt++) {
                var id = newGeneratedId();
                if (!Files.exists(definitionDirectory(id))) {
                    var now = Instant.now();
                    var definition = new ScriptDefinition(id, request.name(), request.sourceCode(), request.tags(),
                            ScriptDefinitionOrigin.USER, now, now);
                    publishNew(definition);
                    LOGGER.info("User script definition created: id={} name={} sourceLength={} tagCount={}",
                            id.value(), definition.name(), definition.sourceCode().length(), definition.tags().size());
                    return definition;
                }
            }
            throw new ScriptDefinitionIdConflictException();
        } catch (ScriptDefinitionStorageException exception) {
            logStorageFailure("create", null, exception);
            throw exception;
        } finally {
            lock.writeLock().unlock();
        }
    }

    /** {@inheritDoc} */
    @Override
    public ScriptDefinition replace(ScriptDefinitionId id, UpdateScriptRequest request) {
        lock.writeLock().lock();
        try {
            var current = findUnderWriteLock(id)
                    .orElseThrow(() -> new ScriptDefinitionStorageException("script definition does not exist"));
            var replacement = new ScriptDefinition(id, request.name(), request.sourceCode(), request.tags(),
                    ScriptDefinitionOrigin.USER, current.createdAt(), Instant.now());
            publishReplacement(replacement);
            LOGGER.info("User script definition replaced: id={} name={} sourceLength={} tagCount={}",
                    id.value(), replacement.name(), replacement.sourceCode().length(), replacement.tags().size());
            return replacement;
        } catch (ScriptDefinitionStorageException exception) {
            logStorageFailure("replace", id, exception);
            throw exception;
        } finally {
            lock.writeLock().unlock();
        }
    }

    /** {@inheritDoc} */
    @Override
    public boolean delete(ScriptDefinitionId id) {
        lock.writeLock().lock();
        try {
            var directory = definitionDirectory(id);
            if (!Files.exists(directory)) {
                return false;
            }
            deleteDirectory(directory);
            LOGGER.info("User script definition deleted: id={}", id.value());
            return true;
        } catch (IOException exception) {
            throw storageFailure(id, exception);
        } finally {
            lock.writeLock().unlock();
        }
    }

    private List<ScriptDefinition> readCompleteDefinitions() {
        if (!Files.isDirectory(root)) {
            return List.of();
        }
        try (Stream<Path> entries = Files.list(root)) {
            return entries.filter(Files::isDirectory)
                    .filter(path -> isValidDirectoryName(path.getFileName().toString()))
                    .map(this::readListEntry)
                    .flatMap(Optional::stream)
                    .toList();
        } catch (IOException exception) {
            throw new ScriptDefinitionStorageException("could not list script definitions", exception);
        }
    }

    private Optional<ScriptDefinition> readListEntry(Path directory) {
        try {
            return Optional.of(readDefinition(directory, new ScriptDefinitionId(directory.getFileName().toString())));
        } catch (RuntimeException exception) {
            LOGGER.warn("Corrupt script definition skipped: directory={} error={}",
                    directory.getFileName(), exception.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    private ScriptDefinition readDefinition(Path directory, ScriptDefinitionId expectedId) {
        try {
            var metadata = objectMapper.readValue(
                    checkedChild(directory, DEFINITION_FILE).toFile(), PersistedDefinition.class);
            var source = Files.readString(checkedChild(directory, SOURCE_FILE), StandardCharsets.UTF_8);
            validateSourceSize(source);
            if (!expectedId.value().equals(metadata.id()) || metadata.origin() != ScriptDefinitionOrigin.USER) {
                throw new ScriptDefinitionStorageException("stored definition metadata is invalid");
            }
            return new ScriptDefinition(expectedId, metadata.name(), source, metadata.tags(), metadata.origin(),
                    metadata.createdAt(), metadata.updatedAt());
        } catch (IOException | IllegalArgumentException exception) {
            throw new ScriptDefinitionStorageException("could not read script definition", exception);
        }
    }

    private void publishNew(ScriptDefinition definition) {
        var temporary = temporaryDirectory(definition.id());
        try {
            writeDefinition(temporary, definition);
            move(temporary, definitionDirectory(definition.id()), false);
        } catch (IOException exception) {
            deleteQuietly(temporary);
            throw new ScriptDefinitionStorageException("could not create script definition", exception);
        }
    }

    private void publishReplacement(ScriptDefinition definition) {
        var temporary = temporaryDirectory(definition.id());
        var target = definitionDirectory(definition.id());
        var backup = root.resolve("." + definition.id().value() + ".backup");
        try {
            writeDefinition(temporary, definition);
            try {
                Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (IOException atomicReplaceFailure) {
                move(target, backup, true);
                try {
                    move(temporary, target, false);
                } catch (IOException failure) {
                    move(backup, target, false);
                    throw failure;
                }
                deleteQuietly(backup);
            }
        } catch (IOException exception) {
            deleteQuietly(temporary);
            throw new ScriptDefinitionStorageException("could not replace script definition", exception);
        }
    }

    private void writeDefinition(Path directory, ScriptDefinition definition) throws IOException {
        validateSourceSize(definition.sourceCode());
        Files.createDirectories(directory);
        writeAndSync(checkedChild(directory, SOURCE_FILE), definition.sourceCode().getBytes(StandardCharsets.UTF_8));
        var metadata = new PersistedDefinition(definition.id().value(), definition.name(), definition.tags(),
                definition.origin(), definition.createdAt(), definition.updatedAt());
        writeAndSync(checkedChild(directory, DEFINITION_FILE), objectMapper.writeValueAsBytes(metadata));
    }

    private void writeAndSync(Path path, byte[] value) throws IOException {
        try (FileChannel channel = FileChannel.open(path, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)) {
            var buffer = ByteBuffer.wrap(value);
            while (buffer.hasRemaining()) {
                if (channel.write(buffer) == 0) {
                    throw new IOException("could not write script definition file");
                }
            }
            channel.force(true);
        }
    }

    private void ensureRootExists() {
        try {
            Files.createDirectories(root);
        } catch (IOException exception) {
            throw new ScriptDefinitionStorageException("could not create script definition directory", exception);
        }
    }

    private Path definitionDirectory(ScriptDefinitionId id) {
        return checkedChild(root, id.value());
    }

    private static ScriptDefinitionId newGeneratedId() {
        while (true) {
            var value = UUID.randomUUID().toString().replace("-", "");
            if (Character.isLowerCase(value.charAt(0))) {
                return new ScriptDefinitionId(value);
            }
        }
    }

    private Path temporaryDirectory(ScriptDefinitionId id) {
        return checkedChild(root, "." + id.value() + "." + UUID.randomUUID() + ".tmp");
    }

    private Path checkedChild(Path parent, String child) {
        var resolved = parent.resolve(child).normalize();
        if (!resolved.startsWith(root)) {
            throw new ScriptDefinitionStorageException("script definition path escaped its configured root");
        }
        return resolved;
    }

    private Optional<ScriptDefinition> findUnderWriteLock(ScriptDefinitionId id) {
        var directory = definitionDirectory(id);
        return Files.exists(directory) ? Optional.of(readDefinition(directory, id)) : Optional.empty();
    }

    private void move(Path source, Path target, boolean replace) throws IOException {
        try {
            if (replace) {
                Files.move(source, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } else {
                Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
            }
        } catch (AtomicMoveNotSupportedException exception) {
            if (replace) {
                Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
            } else {
                Files.move(source, target);
            }
        }
    }

    private void deleteDirectory(Path directory) throws IOException {
        try (Stream<Path> paths = Files.walk(directory)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                Files.delete(path);
            }
        }
    }

    private void deleteQuietly(Path directory) {
        try {
            if (Files.exists(directory)) {
                deleteDirectory(directory);
            }
        } catch (IOException exception) {
            LOGGER.warn("Could not remove unpublished script definition directory {}", directory.getFileName());
        }
    }

    private void validateSourceSize(String source) {
        if (source.getBytes(StandardCharsets.UTF_8).length > maximumSourceCodeBytes) {
            throw new IllegalArgumentException("sourceCode exceeds the configured maximum size");
        }
    }

    private ScriptDefinitionStorageException storageFailure(
            ScriptDefinitionId id,
            IOException exception
    ) {
        ScriptDefinitionStorageException failure = new ScriptDefinitionStorageException(
                "could not " + "delete" + " script definition", exception);
        logStorageFailure("delete", id, failure);
        return failure;
    }

    private void logStorageFailure(String operation, ScriptDefinitionId id, RuntimeException exception) {
        LOGGER.error("User script definition storage failed: operation={} id={} root={}",
                operation, id == null ? null : id.value(), root, exception);
    }

    private static boolean isValidDirectoryName(String value) {
        try {
            new ScriptDefinitionId(value);
            return true;
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    private static boolean matches(ScriptDefinition definition, ScriptDefinitionQuery query) {
        var nameMatches = query.name() == null
                || definition.name().toLowerCase(Locale.ROOT).contains(query.name().toLowerCase(Locale.ROOT));
        return nameMatches && (query.tags().isEmpty() || query.tags().stream().anyMatch(definition.tags()::contains));
    }

    private record PersistedDefinition(
            String id,
            String name,
            List<String> tags,
            ScriptDefinitionOrigin origin,
            Instant createdAt,
            Instant updatedAt) {
    }
}
