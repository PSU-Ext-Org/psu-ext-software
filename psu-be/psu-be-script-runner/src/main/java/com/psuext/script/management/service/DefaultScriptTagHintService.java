package com.psuext.script.management.service;

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

import static com.psuext.script.management.config.ScriptManagementConfiguration.USER_SCRIPT_CATALOGUE;

import com.psuext.script.management.api.ScriptCatalogue;
import com.psuext.script.management.api.ScriptTagHintService;
import com.psuext.script.management.model.ScriptDefinitionQuery;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

/** Default tag-hint service backed by the newest-first user script catalogue. */
@Service
public final class DefaultScriptTagHintService implements ScriptTagHintService {

    private static final int MAXIMUM_TAG_HINTS = 256;
    private static final int SOURCE_PAGE_SIZE = 500;

    private final ScriptCatalogue userCatalogue;

    /** Creates the service for the mutable user script-source namespace. */
    public DefaultScriptTagHintService(@Qualifier(USER_SCRIPT_CATALOGUE) ScriptCatalogue userCatalogue) {
        this.userCatalogue = userCatalogue;
    }

    /** {@inheritDoc} */
    @Override
    public List<String> recentTags() {
        var tags = new LinkedHashSet<String>();
        int offset = 0;
        long total;
        do {
            var page = userCatalogue.list(new ScriptDefinitionQuery(SOURCE_PAGE_SIZE, offset, null, null));
            var pageTags = page.items().stream()
                    .flatMap(definition -> definition.tags().stream())
                    .collect(Collectors.toCollection(LinkedHashSet::new));
            pageTags.removeAll(tags);
            pageTags.stream().limit(MAXIMUM_TAG_HINTS - tags.size()).forEachOrdered(tags::add);

            offset += page.items().size();
            total = page.total();
        } while (tags.size() < MAXIMUM_TAG_HINTS && offset < total);
        return List.copyOf(tags);
    }
}
