# P01 — Switch press-verify to template-press v5.0.0

**References**

- **Trunk:** [PROJECTS.md](../PROJECTS.md)
- **Design:** [TS_PORT_DECISIONS.md](../docs/port/TS_PORT_DECISIONS.md)

Replace temporary template-press git SHA pin with PyPI v5.0.0 once released

### Scope

- Replace the temporary `git+https://github.com/smorinlabs/template-press@04769b24b7b5665d8932cac3a6c1ac876b8a98bb` pin with PyPI `template-press==5.0.0` across all 5 files:
  - `.github/workflows/press-verify.yml`
  - `Justfile` (`press-verify` recipe)
  - `README.md`
  - `docs/tasks/setting-up-development.md`
  - `tests/press-acceptance.test.ts`
- Retain `"smorinlabs/template-press"` in `press/press-rules.toml` `keep_names` and keep `tests/press-config.test.ts` assertions intact.
- Verify `just all`, `just docs-check`, `just press-verify`, and lightweight CI closeout before `--merge`.

### Out of scope

- Removing `https://github.com/smorinlabs/template-press` references from shipped documentation (`AGENTS.md`, `docs/tasks/setting-up-development.md`, `docs/tasks/using-ci-cd.md`, `docs/tools/github-actions.md`, `docs/tutorials/full-project-setup.md`, `docs/reference/project-structure.md`).
- Adding new `template-press` fork-guard scripts or CI bootstrap acceptance (covered by `P07`).

### Decisions

- **Retain `keep_names` (`press/press-rules.toml`):** Keep `"smorinlabs/template-press"` in `press/press-rules.toml` `keep_names` because shipped docs (`AGENTS.md`, `docs/tasks/setting-up-development.md`, `docs/tasks/using-ci-cd.md`, `docs/tools/github-actions.md`, `docs/tutorials/full-project-setup.md`, `docs/reference/project-structure.md`) still reference `https://github.com/smorinlabs/template-press` (verified by `tests/press-config.test.ts:55`).
- **PyPI release pin:** `template-press==5.0.0` is published on PyPI, unblocking replacement of SHA `04769b24b7b5665d8932cac3a6c1ac876b8a98bb` across all 5 files.

### Tests & Tasks

- [ ] [P01-TS01] Update `tests/press-acceptance.test.ts` to use `template-press==5.0.0` and verify `tests/press-config.test.ts` asserts `"smorinlabs/template-press"` remains in `keep_names` with no stale `04769b24b7b5665d8932cac3a6c1ac876b8a98bb` references in the repository.
- [ ] [P01-T01] Replace SHA `04769b24b7b5665d8932cac3a6c1ac876b8a98bb` with `template-press==5.0.0` in `.github/workflows/press-verify.yml` and `Justfile`.
- [ ] [P01-T02] Replace SHA `04769b24b7b5665d8932cac3a6c1ac876b8a98bb` with `template-press==5.0.0` in `README.md` and `docs/tasks/setting-up-development.md`.
- [ ] [P01-T03] Run `just all`, `just docs-check`, `just press-verify`, and `project-audit P01`; open PR, pass CI with lightweight closeout check, resolve review threads, mark `P01` `[x]`, and merge via `--merge`.
