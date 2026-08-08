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

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import com.psuext.connection.config.ConnectionProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Logs configured device profiles when the Spring context is refreshed.
 */
@Component
public class DeviceRegistryStartupLogger {

    private static final Logger LOGGER = LoggerFactory.getLogger(DeviceRegistryStartupLogger.class);

    private final DeviceConnectionDao deviceDao;
    private final ConnectionProperties properties;

    /**
     * Creates the startup device registry logger.
     *
     * @param deviceDao persisted device registry
     * @param properties connection configuration
     */
    public DeviceRegistryStartupLogger(DeviceConnectionDao deviceDao, ConnectionProperties properties) {
        this.deviceDao = deviceDao;
        this.properties = properties;
    }

    /**
     * Logs the persisted device registry once the application context is ready.
     *
     * @param event refresh event for the current application context
     */
    @EventListener(ContextRefreshedEvent.class)
    public void onContextRefreshed(ContextRefreshedEvent event) {
        Path file = properties.devices().file();
        boolean missingBeforeLoad = Files.notExists(file);
        List<DeviceConnection> devices = deviceDao.list();

        if (missingBeforeLoad) {
            LOGGER.info("Device registry file was missing; created empty registry at {}", file.toAbsolutePath());
        }
        if (devices.isEmpty()) {
            LOGGER.info("Loaded 0 device connection profiles from {}", file.toAbsolutePath());
            return;
        }

        LOGGER.info("Loaded {} device connection profile(s) from {}", devices.size(), file.toAbsolutePath());
        devices.forEach(device -> LOGGER.info(
                "Loaded device id={} name={} type={} ip={} port={} baudrate={}",
                device.id(),
                device.name(),
                device.type(),
                valueOrEmpty(device.ip()),
                valueOrEmpty(device.port()),
                device.baudrate() == null ? "" : device.baudrate()));
    }

    private String valueOrEmpty(String value) {
        return value == null ? "" : value;
    }
}


