# PSU-BE Transport

`psu-be-transport` contains the reusable SCPI transport layer for PSU-EXT
backend applications.

## Current Capability

This module owns:

- the `ScpiTransport` abstraction
- the TCP transport implementation
- the USB CDC serial transport implementation
- SCPI text response handling
- SCPI definite-length binary block handling
- shared transport configuration

The current runtime transport implementations are TCP via Spring Integration TCP
and USB CDC serial via jSerialComm.

On Windows x86_64, the transport pre-stages the matching `jSerialComm.dll`
under a private temp directory and points `jSerialComm.library.path` there
before the serial library initializes. The native platform directory is taken
directly from `psu.transport.usb.platform`.

## Configuration

Canonical shared settings live under `psu.transport`:

```yaml
psu:
  transport:
    tcp:
      host: 192.168.4.1
      port: 5025
      connect-timeout: 2s
      read-timeout: 1s
      command-timeout: 2s
      timeout-disconnect-threshold: 3
      line-ending: "\n"
      response-delimiter: "\n"
    usb:
      platform:
      read-timeout: 1s
      command-timeout: 2s
      timeout-disconnect-threshold: 3
      line-ending: "\n"
      response-delimiter: "\n"
```

`psu.transport.usb.platform` selects the bundled native subdirectory directly.
When unset, the backend does not pre-stage a jSerialComm native library and
falls back to the library's default lookup behavior.

Available bundled platform values depend on the current OS:

- Windows: `x86_64`, `x86`, `aarch64`, `armv7`
- macOS: `x86_64`, `x86`, `aarch64`
- Linux: `x86_64`, `x86`, `armv8_64`, `armv7hf`

The configured value only changes the native subdirectory within the current
OS. For example, on Windows the backend will resolve:

```text
/Windows/<platform>/jSerialComm.dll
```

On Linux it resolves:

```text
/Linux/<platform>/libjSerialComm.so
```

These settings are auto-configured when the module is present on the Spring
Boot classpath.

## Local Commands

From `software/psu-be`:

```powershell
.\mvnw.cmd -pl psu-be-transport test
```
