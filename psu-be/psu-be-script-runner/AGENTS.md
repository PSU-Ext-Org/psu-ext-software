# Script Runner Module Notes

## Simulator Tests

Use `FakeScpiTcpServer` from `psu-be-test-support` for SCPI integration tests.
Do not create a local fake SCPI gateway when the test crosses the connection,
transport, or HTTP boundary.

The canonical simulated `*IDN?` response is:

```text
PSU-EXT,PSU-EXT,TEST-0001,0.1.0
```

Keep that response stable across simulator-backed tests unless a test is
explicitly verifying a different device identity.

For Spring Boot 4 running-server HTTP tests, use `RestTestClient` with
`@AutoConfigureRestTestClient`, not `TestRestTemplate`.
