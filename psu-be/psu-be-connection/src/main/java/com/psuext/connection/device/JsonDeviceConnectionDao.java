package com.psuext.connection.device;

/*-
 * #%L
 * PSU-BE Connection
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
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

import com.psuext.connection.config.ConnectionProperties;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

/**
 * JSON-file backed implementation of {@link DeviceConnectionDao}.
 */
@Repository
public class JsonDeviceConnectionDao implements DeviceConnectionDao {

    private static final int MIN_ID = 0;
    private static final int MAX_ID = 255;
    private static final Pattern NAME_PATTERN = Pattern.compile("[A-Z0-9]{1,8}");
    private static final TypeReference<List<DeviceConnection>> DEVICE_LIST_TYPE = new TypeReference<>() {
    };

    private final ObjectMapper objectMapper;
    private final Path file;

    /**
     * Creates a JSON-backed device registry using configured connection
     * properties.
     *
     * @param objectMapper JSON mapper
     * @param properties connection configuration
     */
    @Autowired
    public JsonDeviceConnectionDao(ObjectMapper objectMapper, ConnectionProperties properties) {
        this(objectMapper, properties.devices().file());
    }

    /**
     * Creates a JSON-backed device registry using an explicit file path.
     *
     * @param objectMapper JSON mapper
     * @param file JSON file path
     */
    public JsonDeviceConnectionDao(ObjectMapper objectMapper, Path file) {
        this.objectMapper = objectMapper;
        this.file = file;
    }

    @Override
    public synchronized List<DeviceConnection> list() {
        return sorted(load());
    }

    @Override
    public synchronized DeviceConnection add(DeviceConnection device) {
        List<DeviceConnection> devices = load();
        DeviceConnection normalized = validateForAdd(device, devices);
        int id = nextId(devices);
        DeviceConnection stored = new DeviceConnection(
                id,
                normalized.name(),
                normalized.type(),
                normalized.ip(),
                normalized.port(),
                normalized.baudrate());
        devices.add(stored);
        save(sorted(devices));
        return stored;
    }

    @Override
    public synchronized DeviceConnection modify(String idOrName, DeviceConnectionPatch patch) {
        List<DeviceConnection> devices = load();
        int index = indexOf(devices, idOrName);
        DeviceConnection existing = devices.get(index);
        DeviceConnection candidate = new DeviceConnection(
                existing.id(),
                patch.name() == null ? existing.name() : normalizeName(patch.name()),
                patch.type() == null ? existing.type() : patch.type(),
                patch.ip() == null ? existing.ip() : blankToNull(patch.ip()),
                patch.port() == null ? existing.port() : blankToNull(patch.port()),
                patch.baudrate() == null ? existing.baudrate() : patch.baudrate());
        DeviceConnection normalized = validateForModify(candidate, existing.id(), devices);
        devices.set(index, normalized);
        save(sorted(devices));
        return normalized;
    }

    @Override
    public synchronized DeviceConnection delete(String idOrName) {
        List<DeviceConnection> devices = load();
        int index = indexOf(devices, idOrName);
        DeviceConnection deleted = devices.remove(index);
        save(sorted(devices));
        return deleted;
    }

    @Override
    public synchronized Optional<DeviceConnection> findOneByName(String name) {
        String normalized = normalizeName(name);
        return load().stream()
                .filter(device -> device.name().equals(normalized))
                .findFirst();
    }

    @Override
    public synchronized Optional<DeviceConnection> findOneById(int id) {
        return load().stream()
                .filter(device -> device.id() == id)
                .findFirst();
    }

    private List<DeviceConnection> load() {
        ensureFile();
        try {
            List<DeviceConnection> devices = objectMapper.readValue(file.toFile(), DEVICE_LIST_TYPE);
            return devices == null ? new ArrayList<>() : new ArrayList<>(devices);
        } catch (IOException ex) {
            throw new DeviceConnectionException("DEVICE_STORE_FAILED", safeMessage(ex));
        }
    }

    private void save(List<DeviceConnection> devices) {
        try {
            Path parent = file.toAbsolutePath().getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(file.toFile(), devices);
        } catch (IOException ex) {
            throw new DeviceConnectionException("DEVICE_STORE_FAILED", safeMessage(ex));
        }
    }

    private void ensureFile() {
        if (Files.exists(file)) {
            return;
        }
        save(List.of());
    }

    private DeviceConnection validateForAdd(DeviceConnection device, List<DeviceConnection> devices) {
        DeviceConnection normalized = normalize(device);
        ensureUniqueName(normalized.name(), -1, devices);
        validateTypeFields(normalized);
        ensureUniqueTarget(normalized, -1, devices);
        return normalized;
    }

    private DeviceConnection validateForModify(
            DeviceConnection device,
            int existingId,
            List<DeviceConnection> devices) {
        DeviceConnection normalized = normalize(device);
        ensureValidId(existingId);
        ensureUniqueName(normalized.name(), existingId, devices);
        validateTypeFields(normalized);
        ensureUniqueTarget(normalized, existingId, devices);
        return normalized;
    }

    private DeviceConnection normalize(DeviceConnection device) {
        if (device == null) {
            throw new DeviceConnectionException("BAD_DEVICE", "Device connection is required");
        }
        return new DeviceConnection(
                device.id(),
                normalizeName(device.name()),
                device.type() == null ? null : device.type(),
                blankToNull(device.ip()),
                blankToNull(device.port()),
                device.baudrate());
    }

    private String normalizeName(String name) {
        String normalized = name == null ? "" : name.trim().toUpperCase(Locale.ROOT);
        if (!NAME_PATTERN.matcher(normalized).matches()) {
            throw new DeviceConnectionException("BAD_DEVICE_NAME", "Name must match [A-Z0-9]{1,8}");
        }
        return normalized;
    }

    private void validateTypeFields(DeviceConnection device) {
        if (device.type() == null) {
            throw new DeviceConnectionException("BAD_DEVICE_TYPE", "Type must be TCP or USB");
        }
        if (device.type() == DeviceConnectionType.TCP) {
            require(device.ip(), "TCP ip is required");
            require(device.port(), "TCP port is required");
            parseTcpPort(device.port());
            return;
        }
        require(device.port(), "USB port is required");
        if (device.baudrate() == null || device.baudrate() < 1) {
            throw new DeviceConnectionException("BAD_BAUDRATE", "USB baudrate must be positive");
        }
    }

    private void ensureUniqueName(String name, int allowedId, List<DeviceConnection> devices) {
        boolean duplicate = devices.stream()
                .anyMatch(device -> device.name().equals(name) && device.id() != allowedId);
        if (duplicate) {
            throw new DeviceConnectionException("DUPLICATE_DEVICE_NAME", "Device name already exists");
        }
    }

    private void ensureUniqueTarget(DeviceConnection candidate, int allowedId, List<DeviceConnection> devices) {
        Optional<DeviceConnection> duplicate = devices.stream()
                .filter(device -> device.id() != allowedId)
                .filter(device -> sameTarget(candidate, device))
                .findFirst();
        if (duplicate.isEmpty()) {
            return;
        }
        if (candidate.type() == DeviceConnectionType.TCP) {
            throw new DeviceConnectionException("DUPLICATE_DEVICE_TARGET", "TCP device target already exists");
        }
        throw new DeviceConnectionException("DUPLICATE_DEVICE_TARGET", "USB device port already exists");
    }

    private boolean sameTarget(DeviceConnection left, DeviceConnection right) {
        if (left.type() != right.type()) {
            return false;
        }
        if (left.type() == DeviceConnectionType.TCP) {
            return equalsIgnoreCase(left.ip(), right.ip()) && left.port().equals(right.port());
        }
        return equalsIgnoreCase(left.port(), right.port());
    }

    private boolean equalsIgnoreCase(String left, String right) {
        return left != null && right != null && left.equalsIgnoreCase(right);
    }

    private int nextId(List<DeviceConnection> devices) {
        Set<Integer> used = new HashSet<>();
        for (DeviceConnection device : devices) {
            ensureValidId(device.id());
            used.add(device.id());
        }
        for (int id = MIN_ID; id <= MAX_ID; id++) {
            if (!used.contains(id)) {
                return id;
            }
        }
        throw new DeviceConnectionException("DEVICE_REGISTRY_FULL", "No free device id in range 0..255");
    }

    private void ensureValidId(int id) {
        if (id < MIN_ID || id > MAX_ID) {
            throw new DeviceConnectionException("BAD_DEVICE_ID", "Device id must be between 0 and 255");
        }
    }

    private int indexOf(List<DeviceConnection> devices, String idOrName) {
        Optional<Integer> id = parseId(idOrName);
        for (int i = 0; i < devices.size(); i++) {
            DeviceConnection device = devices.get(i);
            if ((id.isPresent() && device.id() == id.get()) || device.name().equals(normalizeName(idOrName))) {
                return i;
            }
        }
        throw new DeviceConnectionException("DEVICE_NOT_FOUND", "Device not found: " + idOrName);
    }

    private Optional<Integer> parseId(String idOrName) {
        try {
            int id = Integer.parseInt(idOrName == null ? "" : idOrName.trim());
            ensureValidId(id);
            return Optional.of(id);
        } catch (NumberFormatException ex) {
            return Optional.empty();
        }
    }

    private int parseTcpPort(String port) {
        try {
            int parsed = Integer.parseInt(port);
            if (parsed < 1 || parsed > 65535) {
                throw new DeviceConnectionException("BAD_PORT", "TCP port must be between 1 and 65535");
            }
            return parsed;
        } catch (NumberFormatException ex) {
            throw new DeviceConnectionException("BAD_PORT", "TCP port must be a number");
        }
    }

    private void require(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new DeviceConnectionException("BAD_DEVICE", message);
        }
    }

    private String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private List<DeviceConnection> sorted(List<DeviceConnection> devices) {
        return devices.stream()
                .sorted(Comparator.comparingInt(DeviceConnection::id))
                .toList();
    }

    private String safeMessage(Exception ex) {
        String message = ex.getMessage();
        if (message == null || message.isBlank()) {
            return ex.getClass().getSimpleName();
        }
        return message.replace('\n', ' ').replace('\r', ' ');
    }
}


