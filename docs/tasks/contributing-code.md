# Contributing Code

This section provides guidelines and best practices for contributing code to the project. By following these guidelines, you can ensure that your contributions are consistent, maintainable, and aligned with the project's goals.

## Code Style Guidelines

To ensure consistency and maintainability, please follow these code style guidelines when contributing to the project:

- **Line Length**: 100 characters (Oxfmt `printWidth`).
- **Types**: Strict TypeScript everywhere (`strict: true` in `tsconfig.json`); avoid `any` outside test files.
- **Imports**: Sorted automatically by Oxfmt (`sortImports`); prefer relative imports within `src/`.
- **Naming**: `camelCase` for variables and functions, `PascalCase` for types and classes — enforced by review, not a dedicated linter rule.
- **Errors**: Prefer the project's typed error taxonomy (`ConfigError`/`ApiError`, mapped to CLI exit codes) over throwing raw strings or relying on assertions.
- **Tests**: `typescript/no-explicit-any` and `typescript/no-non-null-assertion` are relaxed for `tests/**` and `*.test.ts` (see `.oxlintrc.json` overrides) — loose typing is fine in fixtures and mocks.
- **Security**: Avoid hardcoded credentials; Oxlint's security-adjacent rules (`no-eval`, `no-implied-eval`, `no-new-func`, `no-script-url`) plus CodeQL and OSV-Scanner in CI stand in for `bandit`.

## Development Workflow

1. **Fork the Repository**: Create a fork of the repository on GitHub.
2. **Clone the Repository**: Clone your forked repository to your local machine.
   ```bash
   git clone https://github.com/your-username/ts-launch-blueprint.git
   cd ts-launch-blueprint
   ```
3. **Create a Branch**: Create a new branch for your feature or bugfix.
   ```bash
   git checkout -b my-feature-branch
   ```
4. **Install Dependencies**: Verify tooling, install dependencies, and wire the git hooks.
   ```bash
   make check        # verify node/just are installed
   pnpm install        # install dependencies (also runs the lefthook "prepare" install)
   just setup-hooks   # install git hooks + commit-message template
   ```
5. **Make Changes**: Make your changes to the codebase.
6. **Run Tests**: Run the tests to ensure your changes do not break anything.
   ```bash
   just test
   ```
7. **Commit Changes**: Commit your changes with a clear and descriptive commit message using [Conventional Commits](https://www.conventionalcommits.org/) format. The commit-msg hook (commitlint) enforces a 50-character subject line and 72-character body wrap — see `.gitmessage` for the template and allowed types (`feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`, `revert`).
   ```bash
   git add .
   git commit -m "feat: add feature X"
   ```
8. **Push Changes**: Push your changes to your forked repository.
   ```bash
   git push origin my-feature-branch
   ```

## Using the Justfile

This project includes a `Justfile` that provides convenient commands for common development tasks. [Just](https://github.com/casey/just) is a handy command runner that helps standardize commands across your project.

To use these commands, first [install Just](https://github.com/casey/just#installation). You can see all available commands by running:

```bash
just --list
```

see the [Justfile reference](../reference/cli-reference.md) for more details.

## Code Review Process

The code review process ensures that all contributions meet the project's quality standards. During the review process, maintainers will:

- Review the code for correctness, readability, and adherence to the code style guidelines.
- Provide feedback and request changes if necessary.
- Approve the pull request once all feedback has been addressed.

## Documentation Contributions

- All documentation resides in `docs/`.
- Follow the directory structure for consistency (`about/`, `tasks/`, `tools/`, `reference/`, `tutorials/`, `contributing/`).
- Use plain CommonMark/GFM — relative links between pages, no Sphinx/MyST directives (`{toctree}`, `{ref}`, roles).

## Contributor License Agreement (CLA)

Before we can accept your contributions, you will need to sign a Contributor License Agreement (CLA). This is a legal document in which you state that you are entitled to contribute the code you are submitting and that you grant us the rights to use that contribution.

for more information, see the [Contributor License Agreement](../contributing/index.md#contributor-license-agreement-cla) page.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

If you're filing a bug report, attach the output of `just debug-info` (OS, Node/pnpm/just versions, installed and declared packages) to the "System Information" section of the issue template — see [Using CI/CD](using-ci-cd.md) and the [issue templates](../github-templates.md) for how that information is used.

## Contributors

This project uses [contributors-please](https://github.com/smorinlabs/contributors-please) to automatically track and maintain our [CONTRIBUTORS.md](../../CONTRIBUTORS.md) file. The list of contributors is automatically updated when:

1. The weekly `update-contributors` workflow runs (Mondays, or on-demand via `workflow_dispatch`).
2. Manually using the `just contributors` command.

### Manual Update

To manually update the contributors list:

```bash
pnpm dlx contributors-please
```

### How Contributors are Tracked

Contributors are tracked based on git commit history, recorded in `.contributors.jsonl` and rendered via `.contributors.yml`. The system:

- Counts commits per contributor
- Shows contribution statistics
- Excludes certain email domains (e.g., noreply.github.com)
- Sorts contributors by number of commits

For more details, see the [contributors-please documentation](https://github.com/smorinlabs/contributors-please).
