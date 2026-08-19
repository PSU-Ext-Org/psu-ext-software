# Third-Party Notices

This project (`psu-install`) is licensed under the Apache License, Version 2.0
(see `../LICENSE`). Its release bundles include the following separate,
unmodified components.

The release builder bundles Caddy and Eclipse Temurin as separate, unmodified
components. Caddy is licensed under Apache-2.0. Eclipse Temurin is licensed
under GPLv2 with the Classpath Exception; each release retains its supplied
license and notice material plus the source offer referenced in
`third-party/components.json`.

| Component | License | Distribution notes |
|---|---|---|
| Caddy | Apache-2.0 | Bundled unmodified as the local frontend and reverse-proxy server. |
| Eclipse Temurin 25 | GPL-2.0-only WITH Classpath-exception-2.0 | Bundled unmodified as the Java runtime. Its `legal/` directory and source offer are included in each release archive. |

`components.json` records shared component versions and licensing metadata.
Platform-specific URLs and checksums are release locks in `platforms/*.json`.
Updating a component requires updating both sources after independently
verifying the upstream checksum. Each assembly script copies this document and
the component license materials into its installer bundle.
