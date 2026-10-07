# Contributing

Use Node.js 24+ and pnpm 11.19.0. Install with `pnpm install --frozen-lockfile`, then follow the verification commands in [README.md](README.md). Python 3.11+ is needed only for the release ZIP verification helper.

Keep changes inside the documented fictional simulator scope. `src/planner.ts` owns the deterministic model; tools and manual controls share it. Check numerical changes against independent arithmetic and update the model version, fixtures and explanation together. Avoid real-world availability, navigation, compatibility or price claims without a separately verified data source.

Native browser checks use real Chrome and fail if its WebMCP API is unavailable. The ordinary suite also covers the simulated adapter; describe these checks separately when reporting results. Use isolated fictional browser contexts for both.

Run the existing tests, type check, lint, build and full dependency audit for applicable changes. Source packaging requires a clean committed checkout. `pnpm package:release` creates the ZIP and checksums; `python scripts/unpack-release.py --out ../volt-clean-consumer` checks every tracked byte and extracts a fresh consumer outside the checkout. Install and build that extracted source before considering release delivery verified.

Public reports should state the source/release identity, exact browser and runtime versions, expected and observed results, and recovery steps. Use the security guidance for suspected vulnerabilities.
