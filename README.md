# Volt

[![Checks](https://github.com/agammann/volt-webmcp/actions/workflows/checks.yml/badge.svg)](https://github.com/agammann/volt-webmcp/actions/workflows/checks.yml)

**An EV energy and charging simulator with seven page-side WebMCP tools.** Change a vehicle profile, starting charge, battery reserve, or stop sequence and see the calculated time, electricity cost, and arrival charge change together.

[Open Volt](https://volt.alx21.chatgpt.site/) · [Agent discovery guide](https://volt.alx21.chatgpt.site/llms.txt)

Volt uses **four generic vehicle profiles, six fictional stations, and a fixed 387-mile Los Angeles → San Francisco sample corridor**. It is useful for exploring model tradeoffs and building browser-agent integrations. It provides no live station data, verified connector compatibility, directions, or dependable driving ETA. Do not use it to plan an actual journey.

## Try it

1. Open the site in a modern browser. Manual controls work without WebMCP support.
2. Leave the sample endpoints in place, choose a vehicle profile, and set starting charge and reserve. Click **Build my route** to apply changes.
3. Compare **Fastest**, **Balanced**, and **Comfort**. Each selects stops with a different objective. The results may use the same stations.
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

Requirements: **Node.js 24+** and **pnpm 11.19.0**. No API keys, account, database, or charging-provider credentials are needed.

```bash
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
pnpm security:audit
```

Unit tests cover numerical results, energy/reserve limits, invalid inputs, persistence, and the tool contract. Browser tests exercise recalculation, error preservation, stop replacement, filtering, export, blocked storage, desktop/mobile layouts, and an explicitly mocked registration lifecycle. Mocked tests do not establish native WebMCP compatibility; verify discovery, calls, and visible-state updates separately in a compatible host. CI runs these checks on each push and pull request.

Built with React, TypeScript, Vite, and lucide-react. `src/planner.ts` owns the model; `src/webmcp.ts` owns the tool contract; `src/storage.ts` handles versioned local settings; `src/App.tsx` owns the interface. `scripts/prepare-sites.mjs` packages static assets into a Worker; `scripts/verify-sites-build.mjs` checks the production response contract.

## Hosting and storage

The published site uses Sites. Its `.openai/hosting.json` points to this existing deployment. Forks must configure their own hosting project rather than reuse that ID. The app is also a static Vite build; other static hosts can serve the client assets in `dist` without its `server` and `.openai` subdirectories.

Settings use this origin's `localStorage` key `volt-trip-v1`. Invalid saved data falls back to defaults with a warning; applying a valid plan replaces it. Storage failure leaves the app usable and suggests export. Export is a snapshot; import and cross-tab synchronization are not implemented. There are no app accounts, analytics scripts, provider requests, bookings, or payments. The hosting service still receives normal page and asset requests.

## License

MIT. See [LICENSE](LICENSE).
