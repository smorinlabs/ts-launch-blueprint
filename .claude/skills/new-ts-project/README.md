# `new-ts-project` — bootstrap a project from the blueprint

This skill creates a fresh GitHub repository from `ts-launch-blueprint`,
runs `template-press` `rebrand` on it, validates the generated TypeScript
project, and opens its initialization pull request. The canonical procedure is
[SKILL.md](SKILL.md).

## Location and invocation

The maintained source is `.claude/skills/new-ts-project/` in
`ts-launch-blueprint`.

- **Project-scoped:** inside a blueprint checkout, Claude Code discovers it at
  `.claude/skills/new-ts-project/` and Codex uses the committed
  `.agents/skills/new-ts-project` directory symlink. Agents following
  `AGENTS.md` can read the same file as a runbook. On Windows checkouts without
  Git symlink support, use the canonical path directly.
- **User-scoped (global):** because the runbook instantiates directly from
  `smorinlabs/ts-launch-blueprint` via `gh repo create --template`, you can
  install it globally and invoke it from any directory without entering a local
  blueprint clone:

  ```bash
  mkdir -p ~/.claude/skills ~/.agents/skills
  ln -s /path/to/ts-launch-blueprint/.claude/skills/new-ts-project ~/.claude/skills/new-ts-project
  ln -s /path/to/ts-launch-blueprint/.claude/skills/new-ts-project ~/.agents/skills/new-ts-project
  ```

For predictable invocation, name the skill and supply the identity you know:

```text
Use the new-ts-project skill to create a project from ts-launch-blueprint.
Repo: my-project. Owner: my-org. Package: my_project. CLI: my-project.
Use a private repository at /absolute/path/to/my-project.
```

The description still matches broad TypeScript project creation intent. When
the template choice is unresolved, the skill asks whether the user wants the
full blueprint or a minimal setup. An explicit template request or prior
approval settles that choice; the skill does not ask for it again. Declining
the template exits the skill without introducing a separate minimal-setup mode.

## Bootstrap contract

| Area          | Required behavior                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toolchain     | Node.js 24+, pnpm 10, `just`; generated project version `0.1.0`                                                                                                                 |
| Press engine  | Released `template-press==5.0.0` via `uvx --from template-press==5.0.0 press`                                                                                                   |
| Identity      | All 8 `[identity]` keys (`package_name`, `repo_name`, `app_name`, `cli_name`, `author`, `email`, `owner`, `display_name`)                                                       |
| Input         | Answers file outside the target; the clean-tree guard stays enabled                                                                                                             |
| Order         | Check base tools (`make check` / `make bootstrap`), check press tools, preview cleanup, clean, preview rebrand, apply, `just setup`, `oxfmt`, validate                          |
| Validation    | `just all`, `just docs-check`, `just build` (including `apps/web`), `just pack-check`, `press verify`, CLI `--help` / `--version`, and `scripts/smoke-api.sh` against built API |
| Delivery      | Initialization branch and pull request with validation evidence                                                                                                                 |
| Ongoing setup | Generated `docs/PROJECT_SETUP.md` (`docs/POST_INIT.md`) and `docs/RELEASE.md` hold setup and release steps                                                                      |

The template's declared edits reset initial versions before lock regeneration.
Declared resets and removals retire template history and maintenance content.
The runbook checks the resulting receipt and version agreement before commit.

Rebranding removes the generated target's `SKILL.md` and resets this README to
a retirement notice. When running project-scoped from a local blueprint
checkout, keep reading the runbook from that checkout rather than the generated
target; when installed globally, the user-scoped skill remains available
unchanged. The existing Codex directory symlink remains resolvable, but the
generated project no longer exposes this bootstrap skill. Its
`docs/skills/new-ts-project.md` becomes a short template/provenance pointer.

Full bootstrap authorization covers the necessary local setup and validation.
Package publication, external-service setup, and PR merge remain separate
requested work. The runbook preserves failed checkouts and directs recovery
through engine diagnostics and explicitly reviewed target paths.
