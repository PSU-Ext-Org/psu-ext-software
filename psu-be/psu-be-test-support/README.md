# PSU-BE Test Support

`psu-be-test-support` contains reusable fixtures for backend tests.

## Fake SCPI TCP Server

`FakeScpiTcpServer` starts an in-memory TCP SCPI server. It records every
line-delimited command and replies to configured queries.

```java
try (FakeScpiTcpServer server = FakeScpiTcpServer.start()) {
    server.respondTo("*IDN?", "PSU-EXT,PSU-EXT,TEST-0001,0.1.0");

    int port = server.port();
    // Connect the code under test to 127.0.0.1:port.
}
```

Configuration is held in memory only. Responses are matched by exact command
text after the line ending has been removed. Unknown queries receive no
response, which lets tests exercise timeout behavior. Non-query commands are
recorded and do not receive a response.

## USB Native Platform

`JSerialCommTestPlatformResolver.resolve()` derives the bundled jSerialComm
native-platform directory from the current OS and architecture. For unusual
architectures, override it with the JVM property
`-Dpsu.test.usb.platform=<platform>`.
