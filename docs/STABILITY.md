# Volt v1 stability and recovery

## Supported scope

Volt 1.0.1 explores fictional energy, charging-time and electricity-cost tradeoffs for four generic vehicle profiles, six sample stations and the fixed 387-mile Los Angeles to San Francisco corridor. `volt-energy-v1` is the documented deterministic model. Its current equations, constants, scoring objectives and rounding rules are part of this bounded v1 contract. It supplies no actual route directions, station availability, connector compatibility or dependable driving ETA.

The source requires Node.js 24+ and pnpm 11.19.0. The source targets Windows and Linux; release CI checks Linux, and local acceptance checks Windows. Ordinary Chrome 155.0.8059.39 was measured on Windows; manual controls also remain available when WebMCP is absent. The optional native integration is experimental and limited to the browser/API combinations actually measured. Historical Chrome/Edge 154 records are dated in the README; Chrome 155 uses object arguments. A different host needs its own native check.

## Saved settings and export

`volt-trip-v1` holds versioned applied settings in this site's localStorage. Draft form inputs are separate and remain unfinished until **Build my route** applies them. Choosing a route style recalculates from applied inputs while retaining other draft edits. Unsupported endpoints and invalid inputs preserve the last applied plan. An infeasible model input produces a clearly marked result without time, cost or arrival-charge totals.

An exported `volt-simulation.json` is a snapshot of the applied settings, calculated result and assumptions. It is not an importable backup. To recreate an experiment on another origin, open the JSON, enter its `state` values manually and build again. Only the same sample corridor and profiles are supported. Export before resetting settings or clearing browser data. There is no import, account recovery, encryption or cross-tab synchronization.

Invalid saved settings fall back to defaults with a visible warning; **Reset settings** writes the default sample. If storage is blocked, controls still work for that session and export preserves a snapshot. Browser storage deletion, private browsing cleanup or a different site origin can remove or separate saved settings.

## Upgrade from source version 1.0.0

Install the pinned 1.0.1 ZIP or tag and use the same deployment origin to retain saved settings. The `volt-trip-v1` format and `volt-energy-v1` model are unchanged; this release introduces no settings migration. Export a snapshot first, keep the prior source if rollback is needed, and rebuild/serve from a clean installation. A source update and a hosted deployment have separate delivery checks.

## Tools and releases

The seven tool names, input fields, ranges, success/error responses and explicit feasibility field documented in README.md form the v1 integration contract. Three tools change local applied settings; finding chargers and comparing options may change the visible view. Unknown fields, incorrect types and invalid stop sequences are rejected. Native support is verified through the browser's real discovery and execution methods, with no automatic retry using another argument form.

Patch releases retain those contracts and saved settings. A future incompatible model, storage format or tool change requires a documented version and upgrade path. A source release consists of `volt_<version>_source.zip`, its `.sha256` sidecar and `SHA256SUMS`; verify the checksum before installing. CI checks the exact unpacked source, full audit and browser suites before publication. Public-site acceptance must separately match that source and complete the ordinary and optional native journeys.
