# Volt

[![Checks](https://github.com/agammann/volt-webmcp/actions/workflows/checks.yml/badge.svg)](https://github.com/agammann/volt-webmcp/actions/workflows/checks.yml)

**An EV energy and charging simulator with seven page-side WebMCP tools.** Change a vehicle profile, starting charge, battery reserve, or stop sequence and see the calculated time, electricity cost, and arrival charge change together.

[Open Volt](https://volt.alx21.chatgpt.site/) · [Agent discovery guide](https://volt.alx21.chatgpt.site/llms.txt)

Volt uses **four generic vehicle profiles, six fictional stations, and a fixed 387-mile Los Angeles → San Francisco sample corridor**. It is useful for exploring model tradeoffs and building browser-agent integrations. It provides no live station data, verified connector compatibility, directions, or dependable driving ETA. Do not use it to plan an actual journey.

Source version **1.0.1** retains the `volt-energy-v1` model, seven-tool contract and `volt-trip-v1` applied settings. See [stability, upgrade and recovery guidance](docs/STABILITY.md). The source delivery includes the MIT license, frozen lockfile and SHA256 checksums; hosted acceptance is checked separately.

## What you can learn from Volt

- Explore how starting charge, reserve, and vehicle assumptions affect purchased energy, stop choices, and cost.
- Study a small React app whose manual controls and browser-agent tools use the same validation and calculations.
- Fork the simulator to experiment with different sample vehicle profiles, stations, or route objectives. The model and its limits are documented below.

## Try it

1. Open the site in a modern browser. Manual controls work without WebMCP support. If you have used Volt before, click **Reset settings** to begin with the default sample.
2. Leave the sample endpoints in place, choose a vehicle profile, and set starting charge and reserve. Click **Build my route** to apply changes.
3. Compare **Fastest**, **Balanced**, and **Comfort**. Each selects stops with a different objective using the applied inputs. Clicking a style preserves unfinished form edits; click **Build my route** to apply those edits. The results may use the same stations.
4. Inspect map markers or change a stop in the itinerary. An unreachable, duplicate, backward, or unnecessary replacement is rejected without changing the applied plan.
5. Use **Stations** to filter sample stations by rated power and amenities. Use **How it works** to read the assumptions.
6. Export a JSON snapshot containing the inputs, results, and limitations. Applied settings persist in this browser; **Reset settings** restores the default sample.

For a concrete comparison, the default long-range profile starts at 78% with a 20% reserve. Balanced calculates one stop, **7h 2m**, **$22.70**, and **23% arrival charge**. Change starting charge to 90% and build again: it becomes **6h 57m** and **$18.80**, with the same arrival charge. These are model outputs, not travel estimates.

Unsupported endpoints produce a clear error and preserve the last applied plan. Inputs that cannot satisfy the reserve produce an explicitly infeasible plan with no total time, cost, or arrival-charge claim. Draft inputs remain separate from applied results until submitted.

## WebMCP

The page registers tools through `document.modelContext.registerTool`. A compatible browser/agent host is required to discover and invoke them. This repository does **not** implement a remote MCP server or an HTTP MCP endpoint. The status above the app reports seven ready tools, manual mode, or registration failure.

| Tool                    | Inputs                                                                           | Result / effect                                                    |
| ----------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `get_trip_context`      | `{}`                                                                             | Applied inputs, calculated plan, and assumptions                   |
| `list_vehicle_profiles` | `{}`                                                                             | Four generic range, capacity, and peak-power profiles              |
| `find_chargers`         | Optional `minimumPowerKw` (50–400), `amenity`                                    | Filtered sample stations; displays matching station cards          |
| `compare_route_options` | `{}`                                                                             | Three recalculated options; displays the comparison                |
| `create_trip_plan`      | Optional `origin`, `destination`, `routeStyle`, `startingChargePercent` (10–100) | Applies inputs, clears custom stops, and calculates a plan         |
| `set_trip_preferences`  | Optional `vehicleId`, `minimumArrivalPercent` (5–50), `preferAmenities`          | Applies preferences and recalculates; retains custom stops         |
| `replace_charging_stop` | Required `stopIndex` (zero-based), `chargerId`                                   | Replaces a current stop only if the resulting sequence is feasible |

Styles: `fastest`, `balanced`, `comfort`. Profiles: `compact`, `long-range`, `crossover`, `large-suv`. Amenities: `coffee`, `restrooms`, `food`, `shopping`, `lounge`, `hotel`. Station IDs come from `find_chargers` or the current plan.

Example agent request: **“Use the compact profile, start at 85%, keep a 25% reserve, and compare the route options.”** A host can perform:

```json
{"tool":"set_trip_preferences","arguments":{"vehicleId":"compact","minimumArrivalPercent":25}}
{"tool":"create_trip_plan","arguments":{"startingChargePercent":85,"routeStyle":"fastest"}}
{"tool":"compare_route_options","arguments":{}}
{"tool":"get_trip_context","arguments":{}}
```

These envelopes illustrate the sequence; use your host's actual invocation API. Tools and manual controls share the same validation, model, and applied React state. Unknown fields, wrong types, unsupported values, and invalid replacements return `ok: false` without applying changes. Valid but infeasible planning inputs return `ok: true`, `applied: true`, and `plan.feasible: false`; agents must inspect feasibility before presenting totals.

Successful responses include `dataMode: "SIMULATION"`, model assumptions, limitations, and `data`. Four tools have read-only annotations (finding/comparing may change the visible view); three persist local settings. Registration is owned by an abort signal, retries briefly for a late host, and restarts on a restored page lifecycle.

### Verified browser compatibility

Native discovery and all seven tool calls were verified against the published site on **September 30, 2026**:

| Browser / host                                          | Verified behavior                                                                                                                                                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome 154.0.8037.93 on Windows, WebMCP testing enabled | Native discovery and execution, visible results, invalid-input preservation, reload persistence, and actual back/forward cache restoration                                                                                      |
| Edge 154.0.4258.48 on Windows, WebMCP testing enabled   | The same four native integration tests passed                                                                                                                                                                                   |
| Codex in-app browser agent                              | Discovered and invoked all seven tools through the connected browser's WebMCP interface; the documented planning sequence, station filtering, stop replacement, error preservation, and refreshed discovery after reload worked |
| Chrome 154 with WebMCP testing disabled                 | Manual mode displayed and the normal controls remained available                                                                                                                                                                |

To try native discovery in Chrome, enable `chrome://flags/#enable-webmcp-testing`, relaunch, and reload Volt. The page should report **7 agent tools ready**. See the [Chrome WebMCP setup guide](https://developer.chrome.com/docs/ai/webmcp) for current browser requirements. Compatibility with other browsers and agent hosts needs its own verification.

Chrome 154's `document.modelContext.executeTool` takes JSON-stringified arguments and returns a JSON string for these tools. Chrome's [imperative API documentation](https://developer.chrome.com/docs/ai/webmcp/imperative-api) describes the object-argument change in Chrome 155. The native test helper selects the argument form by Chrome major version and executes each call once; the historical versions above use the string form.

Local source checks on October 6, 2026 used Windows, Node.js **24.19.0**, pnpm **11.19.0**, Playwright **1.58.2** and Chrome **155.0.8059.39**. All 32 unit cases, eight ordinary browser cases and four real native cases passed, including all seven tools, invalid-input preservation, reload and actual back/forward cache restoration. Independent hand-calculated fixtures checked 72 numerical values across all four profiles, the documented 78% and 90% examples, and an infeasible case. These are local simulator checks; a published source archive and public deployment need their own exact-delivery acceptance.

## Calculation model

Model version: **volt-energy-v1**. All values are assumptions, including station mile positions and electricity prices. Every sample charger is assumed available and compatible.

- Battery energy consumed = leg miles ÷ assumed full-charge range × battery capacity.
- Every stop and the destination must be reached at or above the reserve.
- Departure charge covers the next leg plus reserve, with a buffer of 0 percentage points for Fastest, 3 for Balanced, or 10 for Comfort, capped at 100%.
- Purchased electricity = battery energy added ÷ 90% charging efficiency.
- Average charging power = 60% of the lower vehicle/station peak power. Charging duration rounds up to whole minutes.
- Total modeled time = driving at 60 mph + charging + five minutes overhead per stop.
- Cost = purchased electricity × sample station price, rounded to cents per stop. Initial battery energy, taxes, parking, and other fees are excluded.

The planner evaluates all 64 forward-order subsets of the six stations. Fastest minimizes total minutes. Balanced adds 1.5 scoring minutes per dollar. Comfort adds 0.5 per dollar and 0.3 per mile of the longest leg. If amenities are preferred, each stop without both coffee and restrooms adds 12 scoring minutes. These objective weights are **not additional travel time**.

There is no traffic, weather, elevation, degradation, detour calculation, or measured charging curve. This is a transparent what-if model with bounded inputs, not a physical vehicle model.

## Run locally

Requirements: **Node.js 24+** and **pnpm 11.19.0**; Git is needed for a source checkout. The package manager version is pinned in `package.json`; see the [pnpm installation guide](https://pnpm.io/installation) if you need to install it. No API keys, account, database, or charging-provider credentials are needed.

For the pinned source delivery, download `volt_1.0.1_source.zip` and its checksums from the [1.0.1 release](https://github.com/agammann/volt-webmcp/releases/tag/v1.0.1). Verify SHA256 before extracting: PowerShell `Get-FileHash volt_1.0.1_source.zip -Algorithm SHA256`, or Linux `sha256sum -c SHA256SUMS`. Enter the extracted `volt-1.0.1` directory, run `pnpm install --frozen-lockfile`, then `pnpm dev`.

To use the matching source tag:

```bash
git clone https://github.com/agammann/volt-webmcp.git
cd volt-webmcp
git checkout v1.0.1
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite. To serve the production Worker build:

```bash
pnpm build
pnpm serve:build
```

The production preview listens on `http://127.0.0.1:3018`. Stop it before running browser tests, which start their own server on that port.

## Verify changes

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm exec playwright install chrome
pnpm test:webmcp
pnpm security:audit
```

Unit tests cover numerical results, energy/reserve limits, invalid inputs, persistence, and the tool contract. Browser tests exercise recalculation, unfinished-edit preservation when choosing a route style, error preservation, stop replacement, filtering, export, blocked storage, desktop/mobile layouts, and an explicitly mocked registration lifecycle.

`pnpm test:webmcp` runs a separate four-test suite in installed Chrome with `--enable-features=WebMCP`. It starts the production preview and uses the browser's native `getTools` and `executeTool` methods, without injecting a registration shim. Missing native support fails the suite. It checks all seven schemas and calls, visible state changes, 18 invalid calls, explicit infeasibility, persistence, abort cleanup, reload, and actual back/forward cache restoration. Browser versions are attached to the test results. CI installs Chrome and runs this suite as well as the existing checks on main pushes, pull requests and manual runs.

Set `VOLT_WEBMCP_URL` to an existing deployment URL to run the same suite against it; no local preview is started. Each test uses an isolated browser context, so its saved settings do not affect your regular browser profile. Set `VOLT_WEBMCP_CHANNEL=msedge` to use installed Edge. The live-site run records whether back/forward cache restoration occurred; the local production-preview run requires it. These environment variables can be set in your shell before running `pnpm test:webmcp`.

The dependency gate uses the full audit at every severity, with no advisory exception. Source release packaging requires a clean committed checkout and verifies the actual ZIP through a fresh installation, production build and ordinary/native suites before uploading it. `pnpm package:release` creates the ZIP and checksums; `python scripts/unpack-release.py --out ../volt-clean-consumer` additionally compares every tracked source byte and extracts an isolated consumer (Python 3.11+).

Built with React, TypeScript, Vite, and lucide-react. `src/planner.ts` owns the model; `src/webmcp.ts` owns the tool contract; `src/storage.ts` handles versioned local settings; `src/App.tsx` owns the interface. `scripts/prepare-sites.mjs` packages static assets into a Worker; `scripts/verify-sites-build.mjs` checks the production response contract.

## Make it your own

Start with one small experiment, then run the checks above:

- **Change a sample profile or electricity price:** edit `VEHICLES` or `CHARGERS` in [src/planner.ts](src/planner.ts). Keep stations in forward mile order within the sample corridor. Recalculate and compare the model outputs; update tests and documented examples if their assumptions change.
- **Try a different tradeoff:** change `objective` in [src/planner.ts](src/planner.ts). Scoring weights choose a plan; they do not add time to its reported duration.
- **Build a browser-agent interaction:** follow the schemas in [src/webmcp.ts](src/webmcp.ts) and the sequence above. Read the applied state after each change, and check `plan.feasible` before presenting totals.

Changing the corridor requires updating the endpoint validation, distance, station positions, and map together. Any new data source needs its own availability and compatibility checks before the app can make real-world claims.

## Hosting and storage

The published site uses Sites. Its `.openai/hosting.json` points to this existing deployment. Forks must configure their own hosting project rather than reuse that ID. The app is also a static Vite build; other static hosts can serve the client assets in `dist` without its `server` and `.openai` subdirectories.

Settings use this origin's `localStorage` key `volt-trip-v1`. Invalid saved data falls back to defaults with a warning; applying a valid plan replaces it. Storage failure leaves the app usable and suggests export. Export is a snapshot; import and cross-tab synchronization are not implemented. There are no app accounts, analytics scripts, provider requests, bookings, or payments. The hosting service still receives normal page and asset requests.

## License

MIT. See [LICENSE](LICENSE).

See [contributing](CONTRIBUTING.md), [security](SECURITY.md) and [release changes](CHANGELOG.md).
