# Security

Volt is a browser-local fictional simulator. It does not make charging-provider requests, bookings or payments, and it does not store account credentials. Saved settings use this origin's localStorage; they are not encrypted or synchronized. The hosting service receives ordinary page and asset requests.

For a suspected security issue, use [GitHub's private reporting](https://github.com/agammann/volt-webmcp/security/advisories/new) when it is available. Otherwise open an issue requesting a private contact, without sensitive details. Include the exact source version, affected browser or dependency, observed behavior and bounded impact in the private report.

Run `pnpm security:audit` for the full dependency audit. The release gate requires zero reported advisories at every severity; there is no accepted advisory exception or severity filter. The 1.0.1 dependency changes update source-map-js to 1.2.2 and tinypool to 2.1.2. A passing audit describes the reported dependency findings at that check; it is not a general security guarantee.

The native tool API is experimental. Tool inputs pass through the same validation and deterministic model as ordinary controls. Invalid calls preserve applied state, while valid but infeasible inputs produce an explicit infeasible plan without totals. A browser agent may have other browser permissions outside these tools.
