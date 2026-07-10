# Logo placeholder

This directory is the intended home for this project's logo artwork,
mirroring the source repository's layout
(`assets/images/logos/py_launch_blueprint_logo_{100x100,150x150,1024x1024}.png`).

Those three PNGs are **not carried over** in this port: they are
Python-branded artwork (a `py`-themed logo) that would misrepresent this
TypeScript template. Carrying them as-is was rejected; a new
`ts-launch-blueprint`-branded logo is deliberate future work, tracked in
`docs/port/TS_PORT_PLAN.md` (Slice S6b) and `docs/port/TS_PORT_INDEX.md`'s
omission notes.

## What belongs here once it exists

- `ts_launch_blueprint_logo_100x100.png` — small variant, used in README/docs
- `ts_launch_blueprint_logo_150x150.png` — medium variant
- `ts_launch_blueprint_logo_1024x1024.png` — master/high-resolution source

## Wiring it in once the artwork exists

1. Add the PNG file(s) to this directory.
2. Reference the small variant near the top of `README.md`, e.g.:
   ```markdown
   ![ts-launch-blueprint logo](./assets/images/logos/ts_launch_blueprint_logo_100x100.png)
   ```
3. Delete this file.
4. Run `just docs-check` to confirm the new image link resolves.
