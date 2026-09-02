# Volt

Volt is an agent-native EV trip planner built for the WebMCP Challenge. It gives people a visual charging itinerary while exposing the route-planning decisions as structured tools an AI agent can use on the same live page.

**Live demo:** [volt.alx21.chatgpt.site](https://volt.alx21.chatgpt.site)

## What people and agents can do together

- Compare fastest, balanced, and comfort-focused EV routes.
- Inspect charger power, availability, price, amenities, and expected stop duration.
- Set a vehicle profile, starting charge, arrival reserve, and amenity preference.
- Ask an agent to find chargers, create a route, change preferences, or replace a charging stop while every result remains visible on the map.

## WebMCP tools

The top-level page registers seven JavaScript WebMCP tools through `document.modelContext.registerTool`:

1. `get_trip_context`
2. `list_vehicle_profiles`
3. `find_chargers`
4. `compare_route_options`
5. `create_trip_plan`
6. `set_trip_preferences`
7. `replace_charging_stop`

Read tools return enough structured state for an agent to explain its recommendations. Write tools reuse the same React state and planner logic as the human interface, so agent actions update the visible itinerary immediately.

## Built with

Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, Sites, and the JavaScript WebMCP API.

## Run locally

```bash
pnpm install
pnpm dev
```

Then open the local URL in a WebMCP-compatible browser. The app uses realistic sample data for a Los Angeles–San Francisco demo corridor; live charger availability should always be verified before driving.

## Build

```bash
pnpm build
```

## License

MIT. See [LICENSE](LICENSE).

