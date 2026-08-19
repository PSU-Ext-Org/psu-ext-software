# PSU-EXT Installer

`psu-install` contains the native `psu-ext` command-line installer and service
manager for PSU-EXT. The first supported target is 64-bit Linux with user-level
systemd services.

The installer downloads a checksum-verified application bundle from GitHub
Releases, stores the installed software and user data under `~/.psu-ext`, and
manages the Proxy, Script Runner, and Caddy frontend without requiring `sudo`.

## User installation

Install the latest `psu-ext` binary with the release bootstrap script:

```sh
curl -fsSL https://raw.githubusercontent.com/PSU-Ext-Org/psu-ext-software/main/psu-install/install.sh | sh
```

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

`install` registers the user-level systemd services but deliberately leaves
them stopped. `update` downloads the latest release while preserving device
profiles, scripts, results, ports, and other user data.

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
assets/            Future Windows and macOS service templates
scripts/           Linux release bundle assembly
third-party/       Pinned bundled-component versions and checksums
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

Outputs are written to `psu-install/dist/`. Tagged releases are assembled and
published by `.github/workflows/release.yml`. Component downloads are pinned and
verified against the hashes in `third-party/components.json` and the assembly
script.

## Platform status

- Linux x86-64: supported using user-level systemd services.
- Linux ARM64: configuration mapping exists, but release bundles are not yet published.
- Windows and macOS: service templates are reserved for future adapters; the CLI currently refuses to run on these platforms.
- LAN access and authentication are not enabled; the installed stack is local-only.

## Licensing

The installer source is licensed under Apache-2.0. Release bundles include
Caddy and Eclipse Temurin as separately licensed, unmodified components. See
[`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md) and
[`third-party/components.json`](third-party/components.json) for attribution,
source references, versions, and checksums.
