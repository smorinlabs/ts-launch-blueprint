# P01 — Switch press-verify to template-press v5.0.0

Replace temporary template-press git SHA pin with PyPI v5.0.0 once released

### Open questions

- Once switched to PyPI `template-press==5.0.0`, drop `"smorinlabs/template-press"` from `press/press-rules.toml` `keep_names` (and tests) if no remaining files reference it?

### Notes

Blocked on `smorinlabs/template-press` PR #132 (`v5.0.0`) publishing `template-press==5.0.0` to PyPI.

Pin `04769b24b7b5665d8932cac3a6c1ac876b8a98bb` currently appears in:

- `.github/workflows/press-verify.yml` (lines 41-50)
- `Justfile` (`press-verify` recipe, line 450)
- `tests/press-acceptance.test.ts` (`TEMPLATE_PRESS_COMMIT`, line 27)

<!-- Idea state. Minimal by convention.
     Promote with `project-refine P01` when ready. -->
