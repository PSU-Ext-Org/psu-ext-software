# Third-Party Notices

This project (`psu-fe`) is licensed under the Apache License, Version 2.0
(see `../LICENSE`). It depends on the third-party libraries listed below.
Unlike `psu-be`'s Maven dependencies (pulled in as separate runtime JARs),
the packages under "Production dependencies" are bundled directly into the
built browser artifact by Vite (`npm run build`) — they are distributed as
part of `psu-fe`'s own output, not merely referenced at runtime.

This list covers the dependencies declared directly in `package.json`. It
does not enumerate transitive dependencies, except where called out below.

## Production dependencies

Bundled into the built app (`npm run build` output) shipped to the browser.

| Dependency | License | Notes |
|---|---|---|
| `react`, `react-dom` | MIT | |
| `react-router-dom` | MIT | |
| `@codemirror/autocomplete`, `@codemirror/commands`, `@codemirror/lang-javascript`, `@codemirror/language`, `@codemirror/state`, `@codemirror/view` | MIT | |
| `tailwindcss`, `@tailwindcss/vite` | MIT | |
| `lucide-react` | ISC | |
| `uplot` | MIT | |

## Development dependencies

Build/test tooling only; not bundled into the shipped app.

| Dependency | License | Notes |
|---|---|---|
| `vite`, `@vitejs/plugin-react` | MIT | |
| `vitest` | MIT | |
| `@testing-library/react`, `@testing-library/jest-dom` | MIT | |
| `jsdom` | MIT | |
| `license-check-and-add` | Apache-2.0 | Applies/verifies the per-file headers in `src/`/`scripts/`; see `.license-conf/`. |
| `@lizenz/checker` | BSD-3-Clause | Generates/verifies this file; successor to `license-checker-rseidelsohn`. |

## Notable transitive dependency

| Dependency | License | Notes |
|---|---|---|
| `lightningcss` (`lightningcss-darwin-x64` etc.) | MPL-2.0 | Pulled in transitively via Tailwind CSS v4's Vite plugin. File-level weak copyleft — used unmodified as a build-time dependency (CSS transform tooling), not itself bundled into the shipped browser output. Not a redistribution concern the way `psu-be`'s jSerialComm LGPL/GPL/commercial split is, but called out here for visibility since it's the only non-MIT/ISC/Apache/BSD license anywhere in the dependency tree. |

## Action items

- Re-run this inventory whenever `package.json` dependencies change:
  `npx @lizenz/checker --json --depth 0` from `psu-fe/` lists direct
  dependencies and their licenses; cross-check against this file and
  update as needed.
- `npx @lizenz/checker` (no `--depth`) lists the full resolved tree,
  including transitives like `lightningcss` above — useful for confirming
  nothing new and non-permissive has entered the tree.
