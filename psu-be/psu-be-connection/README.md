# PSU-BE Connection

`psu-be-connection` contains reusable device registry, connection management,
raw SCPI command execution, and typed DATA parsing for PSU-EXT backend
applications.

## Current Capability

This module owns:

- configured device profiles
- JSON-backed device persistence
- live transport session ownership by device id
- connect, disconnect, status, and raw SCPI command execution
- typed DATA query parsing for SCPI binary DATA replies

Editing a device through connection management immediately disconnects its live
transport. Changes made directly to the configured JSON file are detected before
the next connection attempt, so a USB-to-TCP or TCP-to-USB edit creates the
correct transport implementation.

The first typed DATA parser converts SCPI definite-length binary block replies
for `:DATA?` commands into a payload-oriented `BinaryDataFrame`.

## Configuration

Canonical shared settings live under `psu.connection`:

```yaml
psu:
  connection:
    devices:
      file: devices.json
```

These settings are auto-configured when the module is present on the Spring
Boot classpath.

## Local Commands

From `software/psu-be`:

```powershell
.\mvnw.cmd -pl psu-be-connection test
```
