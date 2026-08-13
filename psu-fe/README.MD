# PSU-FE

`psu-fe` is the browser operator interface for the PSU-EXT project. It is meant
to stay small and practical: dashboard-style operator pages, a connection
configuration page, and live visibility into raw WebSocket traffic from the
backend proxy.

## Purpose

The frontend connects to `psu-be-proxy` over the UUID-tagged SCPI WebSocket endpoint and
lets an operator:

- configure the WebSocket proxy host, port, and path
- choose the WebSocket scheme, `ws` or `wss`
- toggle proxy auto-connect from the WebSocket widget
- save WebSocket settings when `Connect` is pressed
- clear saved connection settings from the WebSocket widget
- connect/disconnect the browser WebSocket
- load configured backend devices from the proxy registry
- connect/disconnect configured TCP or USB devices through the proxy
- query and display device identity in the device table after connect
- watch raw inbound and outbound WebSocket messages from the config page or top header popup
- send targeted SCPI commands from the WebSocket monitor to a connected device
- add configurable SCPI single-value widgets to operator dashboard pages
- add configurable SCPI protection widgets for OVP/OCP thresholds, trip state, and optional enable control
- customize dashboard widget positions in edit mode

## Stack

- React
- Vite
- Tailwind CSS
- React Router with `HashRouter`
- lucide-react icons
- small local components, shadcn/ui-inspired but not generated

Shared app control sizing is defined in `src/index.css` with
`control-standard`. Config inputs, selects, command inputs, and primary/secondary
form buttons use it to stay aligned at the compact `h-8` size.

## Routes

The app uses hash routing so pages can be opened directly without server-side
route handling:

```text
http://localhost:5173/#/
http://localhost:5173/#/dashboard
http://localhost:5173/#/conf-proxy
http://localhost:5173/#/conf-script
```

Routes are declared in `src/App.jsx`.

The top header is shared across routes. It includes the PSU-EXT CSS logo, route
navigation, and a terminal icon that opens the WebSocket monitor as a popup.

`/` opens the main operator dashboard. `/dashboard` is an alias for the same
dashboard. `/other` opens the secondary dashboard route. `/conf-proxy` contains
the WebSocket proxy device manager. `/conf-script` contains a read-only device
manager configured for the saved Script Runner HTTP API endpoint. `/scripting`
opens the Script Runner source catalogue.
The Script Backend widget configures the HTTP or HTTPS scheme, host, port, and optional root path.
Its Test Connection action checks the current, unsaved endpoint at `/actuator/health`.
The Scripting page calls `/api/scripts/source`: it filters user sources by name
and tags, and creates, edits, or deletes them with a temporary plain-text
textarea. Create and edit dialogs can load a builtin script as a starting template.
It also calls `GET /api/scripts` every five seconds for a newest-first task
history. The task list includes active and terminal tasks, including tasks
recovered as `INTERRUPTED` after a Script Runner restart. Operators can cancel
selected active tasks; logs and detailed results are not displayed there yet.
Device-manager placements select `mode: "ws"` or `mode: "http"`; omitted mode
remains compatible with the WebSocket proxy. HTTP mode supports list, connect,
and disconnect. Its profile add, edit, and delete actions display the Script
Runner's current `501 Not Implemented` response.

## Main Pieces

`src/main.jsx` mounts React and wraps the app in `HashRouter`.

`src/App.jsx` defines the top-level routes and wraps them in
`ConnectionProvider`.

`src/connection/ConnectionContext.jsx` composes focused connection hooks and
exposes the shared runtime state:

- saved connection config
- WebSocket connected/disconnected state
- backend device profiles loaded from `/device-list`
- per-device connected/disconnected state loaded from `/status`
- per-device identity from `CMD deviceName *IDN?`
- raw WebSocket monitor text
- cached SCPI query snapshots
- WebSocket connect/disconnect actions
- per-device connect/disconnect actions
- SCPI snapshot subscription actions
- config save/clear actions

Pure connection helpers live beside it:

- `connection/config/connectionConfig.js`: config defaults, storage, readiness checks, path normalization
- `connection/device/deviceRegistry.js`: `/device-list`, `/status`, and connected-count helpers
- `connection/identity/deviceIdentity.js`: defensive `*IDN?` parsing and sanitizing
- `connection/monitor/monitorLog.js`: monitor timestamp/tag formatting, tag filtering, bounded line buffering, and log trimming
- `connection/monitor/monitorTagQueue.js`: UUID-to-tag matching for monitor messages

Focused connection hooks keep the provider small:

- `connection/ws/useWebSocketSession.js`: browser-to-proxy WebSocket lifecycle and raw sends
- `connection/device/useDeviceConnection.js`: device registry, status, connect/disconnect, and IDN enrichment
- `connection/monitor/useMonitorLog.js`: monitor text state and response tag matching
- `connection/scpi/useScpiQueryScheduler.js`: shared SCPI polling, de-duplication, and snapshot subscriptions

## Architecture Patterns To Extend

The frontend has a few intentional patterns that should be extended before
creating new app-level state, transport, or widget systems.

### Connection Boundary Pattern

`ConnectionProvider` is the only owner of browser-to-proxy connection state. New
features that need WebSocket status, device status, monitor log data, or SCPI
snapshots should extend the focused hooks under `src/connection/` and expose a
small compatibility API through `useConnection()`.

Do:

- keep WebSocket lifecycle code in `connection/ws/useWebSocketSession.js`
- keep device registry/status behavior in `connection/device/useDeviceConnection.js`
- keep monitor log behavior in `connection/monitor/useMonitorLog.js`
- keep SCPI polling/cache behavior in `connection/scpi/useScpiQueryScheduler.js`
- pass command functions and snapshots through `ConnectionProvider`

Avoid:

- opening WebSockets directly from pages or widgets
- parsing `/device-list`, `/status`, or `*IDN?` responses in UI components
- storing high-frequency telemetry directly in broad React context state

### External Store Pattern For Live Data

High-frequency or append-heavy data should live outside ordinary React component
state and be read through subscription APIs. This keeps live telemetry from
re-rendering every consumer of `useConnection()`.

Current examples:

- SCPI values use `subscribeScpiSnapshot(deviceName, query, listener)` plus
  `getScpiQuerySnapshot(deviceName, query)`.
- The WebSocket monitor uses `subscribeWsMessages(listener)` plus
  `getWsMessages()`.
- Protection widgets use targeted SCPI command/verify polling plus browser
  events such as `psu-ext-protection-trip` for cross-widget reactions.

When adding a new live data stream, follow the same shape:

```js
subscribeThing(key, listener) => unsubscribe
getThingSnapshot(key) => immutableSnapshot
```

The snapshot getter must return the same object when the contents have not
changed. Components should consume it with `useSyncExternalStore`.

### Identity-Keyed Scheduling Pattern

SCPI polling is keyed by normalized `deviceName + query`, not by widget. Multiple
widgets may request the same device/query at different frequencies, but the
scheduler sends one backend command for that identity at the fastest requested
interval. Responses are matched by UUID, not by arrival order.

When adding new scheduled SCPI widgets:

- save widget config by widget id
- let `ConnectionProvider` load saved runnable widget configs into the global scheduler
- read the latest result from the snapshot store with `subscribeScpiSnapshot()`
- do not create per-widget `setInterval` polling loops
- keep backend command format as `CMD deviceName <SCPI content>`

### Dashboard Widget Pattern

Dashboard pages are composed with `DashboardPageShell`. A page owns only its
storage key, default layout, and widget registry. The shell owns layout loading,
normalization, persistence, edit mode, reset, and drag behavior.

When adding widgets:

- keep widget body rendering in a focused component
- keep widget settings in widget-specific localStorage helpers
- use stable widget instance ids for persisted settings
- use `actions`, `title`, `render`, and optional `status` entries in the widget registry
- prefer memoized derived values for device lists, filtered rows, and formatted summaries

Avoid putting page-specific device or WebSocket logic into `DashboardPageShell`.
It should remain a reusable layout engine.

### Monitor Log Pattern

The WebSocket monitor is an append-heavy diagnostic stream. It stores bounded
lines and tag counts outside React state, then exposes text and tags to UI
consumers.

When extending monitor behavior:

- append through `appendWsMessage(direction, message, tag)`
- add frontend-only tags through `MONITOR_TAG`
- keep tag filtering as display-only behavior
- preserve the retention limits in `monitorLog.js`
- avoid storing unbounded arrays or full historical logs in browser memory

### Device Lookup Pattern

Device state is normalized once in `useDeviceConnection`. UI code should use
existing device arrays, status maps, and derived maps instead of repeatedly
building ad hoc registries.

When a component performs repeated lookup by id or name, build a memoized
`Map`. When connection hooks need lookup during polling or message handling, add
the map beside the registry state instead of scanning arrays in hot paths.

Config values are saved manually to `localStorage` under:

```text
psu-fe.config
```

The WebSocket monitor is session-only and keeps the latest 128 KB of text. Each
line includes a local timestamp, a frontend-only source tag, the direction, the
request UUID when available, and the raw message:

```text
[yyyy-mm-dd HH:mm:ss.mmm] [TAG] DIRECTION [uuid] message
```

Example:

```text
[2026-05-10 07:30:05.042] [SYSTEM] OUT [54f2f602-98db-4c14-8168-b4ec58e2d8dc] /device-list
[2026-05-10 07:30:05.120] [SYSTEM] OUT [08b0f403-6c3e-4cb4-bf3b-7f33bfa32b5d] /status
[2026-05-10 07:31:02.004] [USER] OUT [a589f5b6-d00b-49a2-8f07-1f4f8e0cbcb8] CMD PSU1 MEAS:VOLT?
[2026-05-10 07:31:02.087] [USER] IN [a589f5b6-d00b-49a2-8f07-1f4f8e0cbcb8] 12.34
```

`SYSTEM` marks app-driven communication such as status checks, connect/disconnect
requests, registry loads, and automatic `CMD deviceName *IDN?` queries. `USER`
marks commands sent through the WebSocket monitor input. The tags are not sent
to the backend; the frontend matches inbound responses to outbound commands by
UUID and falls back to `SYSTEM` for unsolicited lifecycle messages.

The monitor parses tags from the stored text and offers compact available and
selected tag filters above the log. Selecting one or more tags only changes the
displayed log; removing all selected tags restores the full stored text.

## Components

`components/pages/` contains route-level pages:

- `PageOther.jsx`: secondary operator dashboard built with the reusable dashboard shell
- `PageDashboard.jsx`: main operator dashboard built with the same configurable widget system
- `PageConfigProxy.jsx`: WebSocket proxy configuration dashboard widgets
- `PageConfigScript.jsx`: Script Runner HTTP device-manager dashboard widgets

`components/dashboard/` contains reusable dashboard infrastructure:

- `DashboardPageShell`: shared parent for dashboard-style pages. It owns layout
  ID creation, local layout persistence, edit mode, reset, grid rendering, and
  dependency-free drag-to-move behavior.

`components/layout/` contains shared app shell pieces:

- `AppHeader`: sticky top header with logo, nav, and WebSocket monitor popup action
- `PageHeading`: compact shared page intro row
- `WebSocketMonitor`: shared cardless monitor body used by the Config widget and popup wrapper
- `WebSocketMonitorCard`: thin card wrapper around the shared monitor body
- `WebSocketMonitorDialog`: modal wrapper for the shared monitor card

`components/cards/` contains reusable card primitives:

- `OperatorCard`: generic card layout
- `WebSocketAwareCard`: renders different content based on WebSocket state
- `DeviceAwareCard`: renders different content based on an aggregate device state
- `PsuConnectionAwareCard`: checks WebSocket first, then aggregate device state

These card primitives are still useful for ordinary pages. Dashboard pages
should use `DashboardPageShell` directly so cards are not nested inside other
cards.

`components/forms/` contains reusable form controls:

- `Field`: labeled text input using the shared `control-standard` size
- `SelectField`: labeled dropdown using the shared `control-standard` size

## Backend Contract

The frontend expects `psu-be-proxy` to expose:

```text
/ws/scpi
```

Reserved messages used by the UI:

```text
REQ <uuid> /device-list
REQ <uuid> /status
REQ <uuid> /connect deviceName
REQ <uuid> /disconnect deviceName
REQ <uuid> CMD deviceName <SCPI content>
```

Device state is inferred from backend payloads carried inside `RES <uuid> ...`
responses such as:

```text
0,PSU1,TCP,192.168.4.1,5025,
1,USB1,USB,,COM3,115200
STATUS id=0 name=PSU1 state=CONNECTED transport=tcp host=192.168.4.1 port=5025
STATUS id=1 name=USB1 state=DISCONNECTED
OK CONNECTED transport=tcp host=192.168.4.1 port=5025
OK DISCONNECTED
ERR DISCONNECTED ...
```

After a device reports connected, the frontend sends:

```text
REQ <uuid> CMD PSU1 *IDN?
```

The expected response payload is:

```text
<Manufacturer>,<Model>,<Serial Number>,<Firmware Level>
```

The parser treats the response as untrusted input. It stores the parsed identity
on that device row, strips control characters, caps length, and marks malformed
values invalid without changing that device's connection status.

## Operator Workflow

On the Config page:

- `Connect` persists the current WebSocket settings to `localStorage`, then attempts the browser-to-proxy WebSocket connection.
- `Clear` closes the WebSocket, clears in-memory device state, and removes saved config.
- `Proxy auto-connect` is controlled from the WebSocket widget and is saved immediately when toggled. On page refresh, if enabled and
  WebSocket settings are complete, the app connects the WebSocket automatically.
- The Device List widget is a table of backend devices with id, name, type, endpoint, status, per-device auto-connect, and identity.
- Device auto-connect is managed per backend device row. When the proxy WebSocket opens and `/device-list` loads, the app attempts to connect only the device ids with auto-connect enabled.
- Device connection and per-device auto-connect are managed directly from the Device List widget.

The WebSocket monitor can be viewed on the Config page or opened from the top
header terminal icon. Both views use the same monitor card and shared session
log. When the WebSocket is connected and at least one device is connected, the
monitor shows a target device-name dropdown. Commands are sent as explicit
backend commands:

```text
REQ <uuid> CMD PSU1 MEAS:VOLT?
```

Proxy connection-management commands such as `/connect` and `/disconnect` are
blocked in the monitor terminal; WebSocket and per-device connection state
should be managed through the dedicated Config page controls.

## Dashboard Widget System

Dashboard-style pages are built around `DashboardPageShell` in
`src/components/dashboard/DashboardPageShell.jsx`. A page provides a storage key,
a default layout, and a widget registry; the shell handles the rest.

Current dashboard pages:

- `/`: `PageDashboard.jsx`, persisted under `psu-ext.dashboard.operator-layout.v2`
- `/dashboard`: `PageDashboard.jsx`, persisted under `psu-ext.dashboard.operator-layout.v2`
- `/other`: `PageOther.jsx`, persisted under `psu-ext.dashboard.other-layout.v1`
- `/conf-proxy`: `PageConfigProxy.jsx`, persisted under `psu-ext.dashboard.config-layout.v11`
- `/conf-script`: `PageConfigScript.jsx`, persisted under `psu-ext.dashboard.script-config-layout.v1`

The shell stores one layout record per dashboard in `localStorage`:

```js
{
  layoutId: "generated-on-first-load",
  widgets: [
    { id: "telemetry", type: "telemetry", x: 0, y: 1, w: 2, h: 1 },
  ],
}
```

Widget placement fields:

- `id`: stable widget instance ID. This is what preserves user layout edits.
- `type`: key into the page's widget registry.
- `x`: zero-based horizontal grid position.
- `y`: zero-based vertical grid position.
- `w`: horizontal size, `1`, `2`, or `3`.
- `h`: vertical size, `1`, `2`, or `3`.

The desktop grid has 3 columns and unlimited vertical rows. Horizontal sizes map
to one-third, two-thirds, or full-width widgets. Vertical rows use a fixed 256 px
unit, so `h: 1` is 256 px tall, `h: 2` is 512 px, and `h: 3` is 768 px. Below
the `md` breakpoint, dashboard widgets stack into one column per row while
preserving each widget's vertical `h` size. Widget cards keep their header and
status areas fixed inside the card; if widget content does not fit in the
available space, the content area scrolls instead of overflowing the dashboard.

In edit mode, users drag the whole widget card. Movement snaps to the grid.
Widgets cannot be dropped outside the 3-column grid or on top of another widget.
Invalid drops snap back to the previous position. `Reset` restores the
code-defined default layout and creates a fresh layout ID.

### Adding a Dashboard Page

Create a page component that defines a layout and widget registry, then pass
them to `DashboardPageShell`:

```jsx
import { Activity } from "lucide-react";
import { DashboardPageShell } from "../dashboard/DashboardPageShell.jsx";

const STORAGE_KEY = "psu-ext.dashboard.my-page-layout";

const DEFAULT_LAYOUT = [
  { id: "telemetry", type: "telemetry", x: 0, y: 0, w: 2, h: 1 },
  { id: "notes", type: "notes", x: 2, y: 0, w: 1, h: 1 },
];

const WIDGETS = {
  telemetry: {
    icon: Activity,
    title: "Telemetry",
    text: "Live measurements.",
    render: TelemetryWidget,
    status: TelemetryStatus,
  },
  notes: {
    title: "Notes",
    text: "Operator notes.",
    render: NotesWidget,
  },
};

export function MyDashboardPage() {
  return (
    <DashboardPageShell
      defaultLayout={DEFAULT_LAYOUT}
      pageId="my-dashboard"
      storageKey={STORAGE_KEY}
      widgets={WIDGETS}
    />
  );
}
```

Widget definitions:

- `title`: card title shown in the widget header.
- `text`: optional supporting description.
- `icon`: optional lucide icon component.
- `render`: React component for the widget body.
- `status`: optional React component rendered in a standard status footer.

Keep widget content page-specific. `DashboardPageShell` should stay generic and
should not import PSU WebSocket/device registry state or page-specific data directly.

## Local Development

Install Node.js 20 or newer, then run:

```bash
npm install
npm run dev
```

Open the Vite URL printed in the terminal, usually:

```text
http://localhost:5173
```

PowerShell may block `npm.ps1` on some Windows systems. If that happens, use:

```powershell
npm.cmd install
npm.cmd run dev
```

### Chart Renderer Selection

The chart widget renderer is selected at Vite startup with the
`PSU_CHART_RENDERER` environment variable.

Supported values:

- `uplot`
- `svg`

If the variable is unset or contains any other value, the frontend falls back
to `uplot`.

PowerShell examples:

```powershell
$env:PSU_CHART_RENDERER = "uplot"
npm.cmd run dev
```

```powershell
$env:PSU_CHART_RENDERER = "svg"
npm.cmd run dev
```

### Chart Widget History

Chart widgets persist their local sample history in browser `localStorage`.

- Each chart has a configurable `History cap (KiB)` in its settings dialog.
- The default cap is `256 KiB`, and the UI does not allow values above `256 KiB`.
- The chart header shows current history usage versus the configured cap in `KiB`.
- When the cap is reached, the widget keeps the newest samples and discards the oldest stored points first.

### Chart Widget Statistics

Chart widgets can also show a per-series statistics panel inside the widget.

- Statistics are enabled per widget with `Show statistics` in the chart settings dialog.
- When a chart has multiple series, the widget stores which series is used for statistics.
- Individual statistics can be enabled or disabled with checkboxes in the same dialog.
- The default visible statistics are `Min`, `Max`, and `Ripple p-p`.
- Additional available statistics include sample count, average, median, ripple RMS, percentile ripple spread, standard deviation, adjacent-step deltas, trend per second, drift, spike count, frequency, and period.
- Frequency and period are estimated from the selected visible series with autocorrelation, so repeated waveform shape is used instead of simple local peak spacing. If the visible data is too short, flat, or ambiguous, those fields show no value.
- Statistics are calculated in the frontend from the chart's stored and live sample history. No extra backend API is required.
- Each statistic is defined as a dedicated entity under `src/components/widgets/chart/utils/statistics/`, with its own metadata, help text, formatter, and calculation method.
- Disabled statistics are not calculated.

## Build

```bash
npm run build
```

On PowerShell:

```powershell
npm.cmd run build
```

## Tests

```bash
npm run test
```

On PowerShell:

```powershell
npm.cmd run test
```

Tests cover the connection context plus focused helper modules:

- WebSocket URL construction and connection state
- localStorage persistence, clear, and defaults
- auto-connect, including React StrictMode startup behavior
- terminal command sending and blocked connection-management commands
- `/device-list` and multi-device `/status` parsing
- auto-connect for configured TCP and USB devices by configured device name
- device identity query and malformed `*IDN?` responses
- connection timeouts
- monitor timestamp/tag formatting, UUID/tag inference, tag filtering, and trimming
- focused connection hooks for monitor, device connection, and identity behavior
- dashboard layout persistence, edit mode, reset, dragging, and dashboard page integration

## License

`psu-fe` is licensed under the [Apache License, Version 2.0](../LICENSE).
See `../NOTICE` and `THIRD-PARTY-NOTICES.md` for third-party dependency
attributions, and `../CONTRIBUTING.md` for the contribution process.
