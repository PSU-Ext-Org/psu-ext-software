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

import java.util.List;
import java.util.Optional;

/**
 * Persistence boundary for configured device connection profiles.
 */
public interface DeviceConnectionDao {

    /**
     * Lists all configured device profiles ordered by id.
     *
     * @return configured device profiles
     */
    List<DeviceConnection> list();

    /**
     * Adds a new device profile, assigning the smallest free id.
     *
     * @param device device profile with caller-supplied fields; the id is ignored
     * @return stored profile with generated id
     */
    DeviceConnection add(DeviceConnection device);

    /**
     * Partially modifies an existing device profile.
     *
     * @param idOrName existing device id or name
     * @param patch replacement fields
     * @return updated device profile
     */
    DeviceConnection modify(String idOrName, DeviceConnectionPatch patch);

    /**
     * Deletes an existing device profile.
     *
     * @param idOrName existing device id or name
     * @return deleted profile
     */
    DeviceConnection delete(String idOrName);

    /**
     * Finds one device by unique name.
     *
     * @param name device name
     * @return matching profile
     */
    Optional<DeviceConnection> findOneByName(String name);

    /**
     * Finds one device by id.
     *
     * @param id device id
     * @return matching profile
     */
    Optional<DeviceConnection> findOneById(int id);
}


