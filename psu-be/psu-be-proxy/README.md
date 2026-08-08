# PSU-BE Proxy

`psu-be-proxy` is the Spring Boot bridge service between browser clients and
PSU-EXT SCPI transports.

The proxy module is now thin. It owns only the WebSocket protocol, request and
response envelopes, session-default device behavior, and slash-command parsing.
Transport, device registry, connection management, and typed DATA parsing now
live in `psu-be-transport` and `psu-be-connection`.

## Current Capability

The proxy exposes a UUID-tagged WebSocket endpoint and forwards SCPI commands to
configured device connections. Device profiles are persisted as JSON on disk and
can be added, listed, modified, and deleted over the WebSocket protocol.

TCP devices use Spring Integration TCP and can be connected independently at
runtime. USB devices use the saved serial port name and baud rate from the
device profile when `/connect` is called.

## WebSocket API

Endpoint:

```text
/ws/scpi
```

Inner payload commands:

```text
/device-add name,type,ip,port,baudrate
/device-list
/device-modify idOrName,name=...,type=...,ip=...,port=...,baudrate=...
/device-delete idOrName
```

Connection and SCPI payloads:

```text
/connect idOrName
/disconnect idOrName
/status
/status idOrName
CMD idOrName <SCPI content>
<raw SCPI content>
```

Envelope format:

```text
REQ <uuid> <payload>
RES <uuid> <payload>
BIN <uuid> <base64-scpi-block>
```

Examples:

```text
REQ 54f2f602-98db-4c14-8168-b4ec58e2d8dc /device-add PSU1,TCP,192.168.4.1,5025,
REQ 08b0f403-6c3e-4cb4-bf3b-7f33bfa32b5d /device-list
REQ 8ab4e3b8-bd89-4d8e-a58f-50eb1d0dfb4e /connect PSU1
REQ a589f5b6-d00b-49a2-8f07-1f4f8e0cbcb8 CMD PSU1 *IDN?
REQ 60dc306a-9336-45c9-871e-5110c47fa1b2 MEAS:VOLT?
```

Behavior:

- Device ids are auto-generated in the `0..255` range using the smallest free
  id.
- Device names are unique, uppercase alphanumeric, and at most 8 characters:
  `[A-Z0-9]{1,8}`.
- `TCP` devices require `ip` and numeric `port`.
- `USB` devices require `port` and `baudrate`.
- `/device-list` returns newline-separated rows. Each row is comma-separated:
  `id,name,type,ip,port,baudrate`.
- `/device-delete idOrName` disconnects a live device before deleting it.
- `/connect idOrName` connects a configured device and makes it the default
  target for that WebSocket session.
- `CMD idOrName <SCPI content>` sends one SCPI command to an explicit device.
- Raw SCPI frames are sent to the session default set by `/connect idOrName`.
  If the same WebSocket session connects another device later, the latest
  successful `/connect idOrName` becomes that session's default. This default is
  per WebSocket session; other clients keep their own defaults.
- TCP SCPI messages whose first whitespace-delimited command header contains
  `?`, such as `*IDN?`, `OUTPut? CH1`, or `MEAS:VOLT:DATA? CH1`, wait for one
  reply.
- USB SCPI messages follow the same query and non-query behavior as TCP. The
  backend opens the configured serial port from the device profile and appends
  the configured USB line ending to each outbound command.
- TCP SCPI messages whose command header does not contain `?` are written to
  the device and return `OK SENT` without waiting for a device response.
- Commands sent to a disconnected device return `ERR DISCONNECTED ...`.
- Every response echoes the request UUID in either a `RES` or `BIN` envelope.

Response examples:

```text
RES 54f2f602-98db-4c14-8168-b4ec58e2d8dc OK DEVICE_ADDED 0,PSU1,TCP,192.168.4.1,5025,
RES 08b0f403-6c3e-4cb4-bf3b-7f33bfa32b5d 0,PSU1,TCP,192.168.4.1,5025,
RES 8ab4e3b8-bd89-4d8e-a58f-50eb1d0dfb4e OK CONNECTED transport=tcp host=192.168.4.2 port=5025
RES 3a263ccc-c8ae-49bf-9738-4067d46f8b27 STATUS id=0 name=PSU1 state=CONNECTED transport=tcp host=192.168.4.2 port=5025
RES 5d063714-bb0e-454f-8d19-36608bc49047 OK CONNECTED transport=usb port=COM3 baudrate=115200
RES f7f1f64f-3db6-4cb0-b2f3-f5b7100960c2 STATUS id=1 name=USB1 state=CONNECTED transport=usb port=COM3 baudrate=115200
RES 0bddf5d3-d7d0-499e-b1d8-9f4dcd08ed55 ERR DEVICE_NOT_FOUND Device not found: PSU1
BIN 21d53c47-0b8b-4adb-a7c5-1ff6bca2d26b IzE0AQIDBA==
```

Successful SCPI text query responses are returned in `RES` envelopes.
Successful SCPI definite-length binary block responses, such as
`MEAS:VOLT:DATA?`, are returned in `BIN` envelopes whose payload is the full
SCPI block encoded as base64. Successful SCPI commands that do not produce a
device response still return `RES <uuid> OK SENT`.

Session default example:

```text
/connect PSU1
*IDN?
/connect PSU2
MEAS:VOLT?
CMD PSU1 MEAS:CURR?
```

In this example, `*IDN?` is sent to `PSU1`, then `MEAS:VOLT?` is sent to
`PSU2` because `PSU2` is the latest connected default for that WebSocket
session. The final command is sent to `PSU1` because `CMD` always uses its
explicit target.

## Configuration

The proxy now binds directly to the shared transport and connection module
settings:

```yaml
psu:
  transport:
    tcp:
      connect-timeout: 2s
      read-timeout: 1s
      command-timeout: 2s
      timeout-disconnect-threshold: 3
      line-ending: "\n"
      response-delimiter: "\n"
    usb:
      read-timeout: 1s
      command-timeout: 2s
      timeout-disconnect-threshold: 3
      line-ending: "\n"
      response-delimiter: "\n"
  connection:
    devices:
      file: devices.json
```

`psu.connection.devices.file` is the JSON registry file. Relative paths are resolved
from the process working directory. `command-timeout` applies to query
responses. Text query responses are read through `response-delimiter`; SCPI
definite-length binary block responses are read from the block header and do not
require a delimiter. Non-query commands do not wait for `response-delimiter`.
`timeout-disconnect-threshold` is the number of consecutive transport command
timeouts allowed before a connected device is marked disconnected. Any
successful command or query resets the timeout count.

## Local Commands

From `software/psu-be`:

```powershell
.\mvnw.cmd -pl psu-be-proxy -am test
.\mvnw.cmd -pl psu-be-proxy -am spring-boot:run
```

## Manual Real-Device Test

`ManualScpiWebSocketIntegrationTest` is skipped by default. It boots the Spring
app, connects to `/ws/scpi`, adds a TCP device profile, connects it, sends
`*IDN?`, verifies the response, and disconnects.

Enable it only when a real SCPI TCP server is reachable:

```powershell
$env:PSU_MANUAL_SCPI_HOST='192.168.4.1'
$env:PSU_MANUAL_SCPI_PORT='5025'
# Optional exact response assertion:
$env:PSU_MANUAL_SCPI_IDN_EXPECTED='PSU-EXT,...'
.\mvnw.cmd -pl psu-be-proxy -Dtest=ManualScpiWebSocketIntegrationTest -DPSU_MANUAL_SCPI_IT=true test
```
