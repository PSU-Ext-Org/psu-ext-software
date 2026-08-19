# PSU-EXT Installer

`psu-install` contains the native `psu-ext` command-line installer and service
manager for PSU-EXT. It supports 64-bit Linux with user-level systemd services
and Apple Silicon macOS with per-user launch agents.

The installer downloads a checksum-verified application bundle from GitHub
Releases, stores the installed software and user data under `~/.psu-ext`, and
manages the Proxy, Script Runner, and Caddy frontend without requiring `sudo`.

## User installation

On Linux x86-64, install the `psu-ext-linux-amd64` release artifact with:

```sh
curl -fsSL https://raw.githubusercontent.com/PSU-Ext-Org/psu-ext-software/main/psu-install/install-linux.sh | sh
```

On Apple Silicon macOS, install the `psu-ext-darwin-arm64` release artifact
with the separate macOS bootstrap:

```sh
curl -fsSL https://raw.githubusercontent.com/PSU-Ext-Org/psu-ext-software/main/psu-install/install-macos.sh | sh
```

Each bootstrap downloads only the named platform CLI plus `checksums.txt`,
verifies its SHA-256 checksum, and installs it as `$HOME/.local/bin/psu-ext`.
It does not download or start the application bundle; `psu-ext install` performs
that step afterward.

Ensure `$HOME/.local/bin` is on `PATH`, then install and start PSU-EXT:

```sh
psu-ext install
psu-ext start
```

`psu-ext start` prints the local browser URL. Services and Caddy bind to
loopback interfaces only.

## Commands

```text
psu-ext install [--version VERSION]
psu-ext start
psu-ext stop
psu-ext restart
psu-ext status
psu-ext logs [proxy|runner|caddy]
psu-ext update
```

`install` registers user-level systemd units or macOS launch agents but
deliberately leaves them stopped. `update` downloads the latest release while
preserving device profiles, scripts, results, ports, and other user data.

## Installed layout

```text
~/.psu-ext/
├── config/                  # Generated Spring, frontend, and Caddy configuration
├── data/
│   ├── devices.json
│   ├── script-definitions/
│   └── script-storage/
├── releases/<version>/      # Immutable versioned application bundles
├── current                  # Symlink to the active release
├── logs/
└── install-state.json       # Active version and allocated local ports
```

The installer allocates three consecutive available loopback ports from
`18080-18179` during the first installation and reuses them across updates.

## Source structure

```text
cmd/psu-ext/       CLI entry point and command dispatch
internal/appconfig Generated Spring, frontend runtime, and Caddy configuration
internal/installer Installation orchestration
internal/release   Release manifests, downloads, checksums, and archive handling
internal/state     Persistent state, data layout, and port allocation
internal/systemd   Linux user-service installation and lifecycle
internal/launchd   macOS launch-agent installation and lifecycle
platforms/         Additive target descriptors used by CI and release tooling
assets/            Future Windows service template
scripts/           Platform assembly and shared release tooling
third-party/       Shared bundled-component versions and licensing metadata
```

Tests live beside their corresponding packages and use external test packages
such as `state_test` and `release_test`.

## Development

Go 1.25 or newer is required to build the CLI:

```sh
go fmt ./...
go test ./...
go vet ./...
go build ./cmd/psu-ext
```

The root CI workflow checks formatting and runs all Go tests from this module.

## Release assembly

From the repository root on Linux, assemble the backend JARs, frontend, Caddy,
and Eclipse Temurin 25 runtime with:

```sh
bash psu-install/scripts/assemble-linux.sh 1.2.3
```

On Apple Silicon macOS, use the equivalent assembly script:

```sh
bash psu-install/scripts/assemble-macos.sh 1.2.3
```

Outputs are written to `psu-install/dist/`. Tagged releases are assembled and
published by `.github/workflows/release.yml`. Each file under `platforms/` pins
that target's component downloads and checksums; `third-party/components.json`
holds shared component versions, licenses, and source references.

For local release testing, set `PSU_EXT_RELEASE_BASE_URL` on either platform to
an HTTP server that exposes the same `/latest/download/...` or
`/download/<tag>/...` paths as GitHub Releases. The installer still reads
`release-manifest.json` and verifies the selected bundle checksum.

### Adding another platform

Platform discovery is additive. Add a descriptor under `platforms/`, a
platform-specific adapter, assembler, and clearly named bootstrap script. The
adapter provides service management plus archive extraction, bundle validation,
and activation; Unix targets can reuse the tar/symlink defaults. CI, release
matrices, manifest generation, and checksum generation read the descriptors
automatically; existing platform files do not need edits.

## Platform status

- Linux x86-64: supported using user-level systemd services.
- macOS ARM64: supported using per-user launch agents.
- Linux ARM64: configuration mapping exists, but release bundles are not yet published.
- Windows and Intel macOS: not currently supported.
- macOS release binaries are unsigned and may require approval in Privacy & Security on first launch.
- LAN access and authentication are not enabled; the installed stack is local-only.

## Licensing

The installer source is licensed under Apache-2.0. Release bundles include
Caddy and Eclipse Temurin as separately licensed, unmodified components. See
[`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md) and
[`third-party/components.json`](third-party/components.json) for attribution,
source references, and versions. Platform checksums are recorded in
[`platforms/`](platforms/).
