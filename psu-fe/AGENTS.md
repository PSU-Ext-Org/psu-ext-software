# PSU-FE Agent Notes

Keep this frontend small, explicit, and easy to reason about.

## Plan Mode Behavior

- When working in the plan mode always first ask user for task or feature reference
- When providing plan - always save it as .md in .spec/{ref} foloder of the project you are working on. Name file plan-{ref}.md
- When plan is approved split it into tasks-{ref}.md and save them spec/{ref} folder; 
- Tasks should be atomic. After implementing each task project should compile and tests should pass. 

## Change Rules

- Add or update JSDoc for exported components, hooks, providers, and reusable helpers.
- Update `README.MD` when changing project purpose, structure, routes, commands, backend protocol assumptions, or operator workflow.
- Add or update tests for behavior changes, especially connection state, WebSocket messages, persistence, routing, and user-visible states.
- Run `npm.cmd run test` and `npm.cmd run build` before considering frontend changes complete.

## Build Output

- Frontend builds must be quiet on success. The local `.npmrc` silences npm's run-script banner, and `npm.cmd run build` uses `scripts/quiet-build.mjs`, which prints only `vite build: OK` when the build passes.
- If the build fails, the quiet build script prints the captured Vite output and returns the failing exit code.
- If a sandbox `EPERM` or subprocess permission error prevents Vite/esbuild from starting, rerun the same quiet build wrapper with escalated permissions.
- Use full live build output only when actively debugging a build failure.

## Architecture Preferences

- Keep route-level UI in `src/components/pages`.
- Keep reusable cards in `src/components/cards`.
- Keep reusable form controls in `src/components/forms`.
- Keep small widgets as single files in `src/components/widgets`.
- Treat `500` lines as the absolute maximum for any frontend source file.
- If a file approaches that limit, split it before adding more behavior.
- Prefer splitting by responsibility, for example `components/`, `hooks/`, `utils/`, `storage/`, or widget-local config modules.
- For multi-file widgets, use a folder under `src/components/widgets/<widget-name>` with this shape:
  - `index.js` exports the public widget API used by pages and other features.
  - `components/` contains React components for the widget.
  - `hooks/` contains widget-specific React hooks.
  - `renderers/` contains alternate rendering implementations.
  - `storage/` contains widget-specific persistence helpers.
  - `utils/` contains pure formatting, parsing, validation, and data helpers.
  - `__tests__/` contains tests for that widget folder.
- Import multi-file widgets through their `index.js` from outside the widget folder; keep direct subfolder imports internal to the widget unless a helper is intentionally public.
- Keep shared WebSocket/config/device state in `src/connection/ConnectionContext.jsx`.
- Use the `control-standard` class from `src/index.css` for compact form inputs, selects, and form/action buttons that should align with Config page controls.
- Prefer small plain React components over new libraries unless complexity clearly justifies the dependency.

## Connection Behavior

- Browser-to-proxy WebSocket state and proxy-to-device state are separate.
- Device connect should check `/status` before sending `/connect <host> <port>`.
- Pending WebSocket and device connect actions must have timeouts and visible UI feedback.
- The WebSocket monitor should log important raw inbound/outbound messages and connection lifecycle events.
