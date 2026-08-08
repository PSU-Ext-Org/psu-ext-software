# Third-Party Notices

This project (`psu-be`) is licensed under the Apache License, Version 2.0
(see `../LICENSE`). It depends on the third-party libraries listed below, none
of which are bundled into or distributed as part of this project's own
source or binaries — they are pulled in as ordinary Maven dependencies at
build/run time.

This list covers the dependencies declared directly in `psu-be-bom` and the
module POMs. It does not enumerate transitive dependencies.

## Runtime / compile-scope dependencies

| Dependency | License | Notes |
|---|---|---|
| `com.fazecast:jSerialComm` | LGPL-3.0 **or** GPL-3.0 **or** a separate commercial license (recipient's choice) | Not modified, not bundled/statically linked. See `../NOTICE`. |
| `org.springframework.boot:*` (Spring Boot starters, `spring-boot-dependencies`) | Apache-2.0 | |
| `org.springframework.integration:spring-integration-ip` | Apache-2.0 | |
| `com.fasterxml.jackson.core:jackson-databind`, `com.fasterxml.jackson.datatype:jackson-datatype-jsr310` | Apache-2.0 | |
| `org.springdoc:springdoc-openapi-starter-webmvc-ui` | Apache-2.0 | |
| `org.slf4j:slf4j-api` | MIT | |
| `org.graalvm.polyglot:polyglot`, `org.graalvm.polyglot:js` | Universal Permissive License (UPL) 1.0 | Oracle GraalVM Community artifacts; confirm the exact terms for the pinned version (`graaljs.version` in `psu-be-bom`) before redistribution, as Oracle has changed GraalVM licensing terms across releases. |

## Test-scope dependencies

Not distributed with build artifacts; listed for completeness.

| Dependency | License |
|---|---|
| `org.springframework.boot:spring-boot-starter-test` (JUnit 5, AssertJ, Hamcrest, JSONassert, XMLUnit, Mockito) | EPL-2.0 (JUnit 5), Apache-2.0 (AssertJ, JSONassert, XMLUnit), BSD-3-Clause (Hamcrest), MIT (Mockito) |
| `org.mockito:mockito-core`, `org.mockito:mockito-junit-jupiter` | MIT |

## Action items

- Re-run this inventory whenever `psu-be-bom` dependency versions change.
- Confirm the GraalVM polyglot/js license terms for the currently pinned
  version before any binary redistribution.
- Refresh/cross-check this list against actual resolved dependencies via
  `org.codehaus.mojo:license-maven-plugin`, wired into this workspace's
  reactor aggregator (`pom.xml`, same directory as this file):
  `./mvnw org.codehaus.mojo:license-maven-plugin:2.5.0:aggregate-add-third-party`
  (writes `target/generated-sources/license/THIRD-PARTY.txt`). This catches
  transitive dependencies this hand-written list omits. The same plugin also
  manages per-file source headers (`psu-be-parent/pom.xml`) and the project
  `LICENSE`/`NOTICE` files — one plugin, three separate goal groups.
