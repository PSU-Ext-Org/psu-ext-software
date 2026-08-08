# PSU-BE

`psu-be` is the Java backend workspace for PSU-EXT.

It is a Maven multi-module project containing shared build metadata, reusable
transport and connection-management modules, the Spring Boot proxy service that
bridges browser clients to PSU-EXT SCPI transports, and the dedicated
script-runner application for PC-side SCPI automation.

## Modules

- `psu-be-bom`: backend dependency version management.
- `psu-be-parent`: shared Maven build configuration.
- `psu-be-test-support`: reusable backend test fixtures.
- `psu-be-transport`: reusable transport and SCPI wire handling.
- `psu-be-connection`: reusable device registry, connection management, and
  typed DATA parsing.
- `psu-be-script-runner`: dedicated PC-side script runner and task result
  capture boundary.
- `psu-be-proxy`: Spring Boot WebSocket-to-SCPI proxy service.

## Current Proxy Capability

`psu-be-transport` provides the reusable TCP and USB CDC transport
implementations and SCPI definite-length binary block handling.

`psu-be-connection` provides the reusable JSON device registry, live connection
ownership, raw SCPI command execution, and typed DATA parsing.

`psu-be-proxy` exposes a raw text WebSocket endpoint at:

```text
/ws/scpi
```

The current transport implementations are TCP via Spring Integration TCP and USB
CDC serial via jSerialComm. The WebSocket layer now depends on the shared
connection and transport modules, so future backend applications can reuse the
same transport, connection, and DATA parsing code without inheriting the
browser-facing protocol.

See `psu-be-proxy/README.md` for endpoint details and compatibility
configuration. See `psu-be-transport/README.md` and
`psu-be-connection/README.md` for the shared module APIs and canonical
configuration prefixes.

`psu-be-script-runner` is a separate Spring Boot application for PC-side SCPI
scripting. Its current result-capture boundary stores log and record events,
extracts MVP time-value series records, and builds immutable terminal task
results. See `psu-be-script-runner/README.md` for script-runner details.

## Local Setup

Use PowerShell from this directory:

```powershell
cd 'D:\!Electronics\Projects\PSU-EXT\software\psu-be'
$env:JAVA_HOME='C:\Program Files\Microsoft\jdk-25.0.3.9-hotspot'
$env:MAVEN_USER_HOME=(Resolve-Path '.mvn').Path
$env:MAVEN_OPTS='-Dmaven.repo.local=D:\!Electronics\Projects\PSU-EXT\software\psu-be\.mvn\repository'
```

Common commands:

```powershell
.\mvnw.cmd validate
.\mvnw.cmd test
.\mvnw.cmd package
.\mvnw.cmd -pl psu-be-proxy spring-boot:run
```

## Repository Hygiene

Backend-local generated files are ignored by `software/psu-be/.gitignore`,
including Maven local repository data, wrapper distributions, and Java `target/`
build outputs.

When backend code changes materially affect behavior, public interfaces,
configuration, setup, or module responsibilities, update the relevant module
README in the same change. See `STEERING.md` for the standing workflow notes.

## License

`psu-be` is licensed under the [Apache License, Version 2.0](../LICENSE).
See `../NOTICE` and `THIRD-PARTY-NOTICES.md` for third-party dependency
attributions, and `../CONTRIBUTING.md` for the contribution process.
