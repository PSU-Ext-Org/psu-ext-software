# PSU-BE Steering Notes

## Documentation Rule

When code changes introduce or materially change behavior, public interfaces,
configuration, module responsibilities, setup steps, or an important feature,
update the relevant `README.md` in the same change.

For backend module changes, prefer the module README closest to the code:

- `psu-be-bom/README.md` for dependency/version-management changes.
- `psu-be-parent/README.md` for shared build or plugin behavior.
- `psu-be-proxy/README.md` for proxy runtime behavior, API, transport, and
  configuration changes.

Tiny internal refactors that do not affect behavior, commands, configuration, or
module responsibilities do not need README updates.

## Design Principles (MUST APPLY)

Keep domain models and operational behavior separate. Records, DTOs, and other
models should represent validated state and serialization boundaries; services,
executors, assemblers, and task objects should own behavior and lifecycle. Do
not create classes that mix mutable task state, result models, host bindings,
storage, and execution policy without a clear ownership reason.

Use explicit domain types at application boundaries. Validate external,
JavaScript, transport, and configuration input at the boundary and wrap it in a
defined model before passing it deeper into the application. Avoid generic
object-to-object conversion APIs, untyped JSON tree models, and public methods
whose contract is effectively “accept any object” when the data shape is known.

Treat task execution as a lifecycle boundary. A running task owns task-local
mutable state and execution resources; its terminal result is an immutable model
containing final status and completion time. Keep execution, event capture,
result assembly, logging, storage, and host integration as separate
collaborators with narrow contracts.

Use Spring dependency injection for application services. When a collaborator
contains task-local mutable state, configure it as a prototype and expose a
standard supplier or provider for creating a fresh instance. Create prototype
dependencies through Spring as well, including supplier-backed dependencies.
Avoid custom factory abstractions when a standard supplier/provider expresses
the lifecycle clearly. Do not pass Spring-managed application services through
ordinary method parameters merely to compensate for missing bean configuration.

Keep script APIs explicit and typed. Prefer positional signatures with clear
primitive or domain-value contracts for script host functions. Validate enum
values, dates, strings, numbers, argument counts, and cancellation state at the
binding boundary. Script bindings should call task-local services; they should
not construct result models, manage task lifecycle, or access mutable assembly
internals directly.

Keep tests readable and layered. Move simulator, Spring context, service graph,
and reusable writer setup into test fixtures so test methods describe behavior
and assertions. Reuse common test writers and fixtures; retain capturing fakes
only where the test asserts captured output. Prefer shared transport simulators
and real adapters for integration coverage over local fakes that bypass the
production boundary.

Run verification with quiet build commands by default. Redirect test output when
possible and report only pass/fail unless diagnostics are required to resolve a
failure.

## Java Documentation Rule

When adding or materially changing Java classes, interfaces, records, enums, or
public methods, add or update JavaDoc in the same change.

Prefer JavaDoc that explains the contract, lifecycle, transport boundary,
configuration meaning, or wire behavior. Avoid comments that only repeat the
method name or restate obvious implementation details.

## Formatting Rule

Keep source, test, and documentation lines at or below IntelliJ IDEA's default
right margin of 120 characters unless a longer line is unavoidable, such as a
literal URL or externally defined command.

## Maven In This Environment

Use PowerShell from the backend root:

```powershell
cd 'D:\!Electronics\Projects\PSU-EXT\software\psu-be'
```

Java is installed here:

```powershell
$env:JAVA_HOME='C:\Program Files\Microsoft\jdk-25.0.3.9-hotspot'
```

The Maven wrapper works with the project-local Maven cache. This avoids writing
to `C:\Users\Maxim\.m2`, which can be blocked in the current sandboxed shell:

```powershell
$env:MAVEN_USER_HOME=(Resolve-Path '.mvn').Path
$env:MAVEN_OPTS='-Dmaven.repo.local=D:\!Electronics\Projects\PSU-EXT\software\psu-be\.mvn\repository'
```

Recommended full setup block:

```powershell
cd 'D:\!Electronics\Projects\PSU-EXT\software\psu-be'
$env:JAVA_HOME='C:\Program Files\Microsoft\jdk-25.0.3.9-hotspot'
$env:MAVEN_USER_HOME=(Resolve-Path '.mvn').Path
$env:MAVEN_OPTS='-Dmaven.repo.local=D:\!Electronics\Projects\PSU-EXT\software\psu-be\.mvn\repository'
```

Common commands:

```powershell
.\mvnw.cmd -version
.\mvnw.cmd validate
.\mvnw.cmd test
.\mvnw.cmd package
.\mvnw.cmd -pl psu-be-proxy spring-boot:run
```

Quiet variants:

```powershell
.\mvnw.cmd -q validate
.\mvnw.cmd -q test
```

Force Maven to retry dependency downloads after a cached failure:

```powershell
.\mvnw.cmd -U validate
```

Current verified baseline:

- JDK: Microsoft OpenJDK `25.0.3`
- Maven Wrapper: `3.3.4`
- Maven distribution: `3.9.14`
- Verified commands: `.\mvnw.cmd -version`, `.\mvnw.cmd validate`, `.\mvnw.cmd test`

Expected note with JDK 25:

- Maven may print native-access warnings from Jansi. They are warnings only and
  did not block validation or tests.
