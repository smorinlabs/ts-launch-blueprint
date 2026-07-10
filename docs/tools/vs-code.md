# Recommended VS Code Setup

This guide covers the recommended Visual Studio Code (VS Code) extensions, debug configurations, and workspace settings for the TS Launch Blueprint project — all committed under `.vscode/`.

## Recommended Extensions

`.vscode/extensions.json` recommends these 9 extensions:

1. **oxc** (`oxc.oxc-vscode`)
   - Editor integration for Oxlint and Oxfmt — inline lint diagnostics and format-on-save for the project's actual lint/format toolchain.
2. **Even Better TOML** (`tamasfe.even-better-toml`)
   - Syntax highlighting, formatting, and validation for TOML files (`release-please-config.json` neighbors aside, TOML still appears in editor/tool config).
3. **YAML** (`redhat.vscode-yaml`)
   - Validation, autocompletion, and hover support for the workflow files under `.github/workflows/` and other YAML config.
4. **GitLens** (`eamodio.gitlens`)
   - Enhances the built-in Git capabilities of VS Code with blame annotations, code lens, and more.
5. **Code Spell Checker** (`streetsidesoftware.code-spell-checker`)
   - A basic spell checker that works well with camelCase code.
6. **CodeRabbit** (`coderabbit.coderabbit-vscode`)
   - AI code review integration, matching the org's CodeRabbit usage on pull requests.
7. **GitHub Pull Requests** (`GitHub.vscode-pull-request-github`)
   - Review and manage GitHub pull requests from inside the editor.
8. **GitHub Actions** (`GitHub.vscode-github-actions`)
   - Inline validation and status for the workflows under `.github/workflows/` (see [GitHub Actions](github-actions.md)).
9. **Claude Code** (`Anthropic.claude-code`)
   - Editor integration for this project's AI-agent workflows (see `AGENTS.md`/`CLAUDE.md`).

There is no Pylance/MyPy/Ruff analogue to install: TypeScript language support (IntelliSense, go-to-definition, inline type errors) is built into VS Code, and the `oxc` extension above covers linting and formatting.

## Installing Extensions

To install these extensions, follow these steps:

1. Open VS Code.
2. Go to the Extensions view by clicking on the Extensions icon in the Activity Bar on the side of the window or by pressing `Ctrl+Shift+X`.
3. Search for each extension by name and click the Install button.

Alternatively, you can install extensions from the command line using the `code` command:

```bash
code --install-extension oxc.oxc-vscode
code --install-extension tamasfe.even-better-toml
code --install-extension redhat.vscode-yaml
code --install-extension eamodio.gitlens
code --install-extension streetsidesoftware.code-spell-checker
code --install-extension coderabbit.coderabbit-vscode
code --install-extension GitHub.vscode-pull-request-github
code --install-extension GitHub.vscode-github-actions
code --install-extension Anthropic.claude-code
```

## Debug Configurations

`.vscode/launch.json` ships three `node`-type launch configurations built on VS Code's bundled `vscode-js-debug` — no extra debugger extension is required:

| Configuration                  | Runs                                         | Use case                                                                                                                                       |
| ------------------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLI: Launch (tsx)`            | `tsx src/cli.ts`                             | Debug the CLI directly from TypeScript source, no build step.                                                                                  |
| `CLI: Launch (tsx, With Args)` | `tsx src/cli.ts --workspace test --limit 10` | Same as above, pre-populated with sample arguments — edit the `args` array to match the scenario you're debugging.                             |
| `CLI: Launch dist build`       | `dist/cli.js`                                | Debug the built output, with `sourceMaps: true` and `outFiles` pointed at `dist/**/*.js` so breakpoints resolve back to the TypeScript source. |

Open the Run and Debug view (`Ctrl+Shift+D` / `Cmd+Shift+D`), pick a configuration, and press F5 to launch the CLI under the debugger with breakpoints in your TypeScript source. For debugging the CLI's _configuration resolution_ (which layer a value came from) rather than attaching a debugger, see [Debugging Configuration](../tasks/debugging-configuration.md).

## Workspace Settings

`.vscode/settings.json` commits exactly one key:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

This pins the editor's TypeScript language service to the **workspace's own** installed TypeScript version, rather than VS Code's bundled TypeScript. It exists so that inline type errors shown in the editor always match what `tsc --noEmit` (`just typecheck`) reports in CI — without it, a version mismatch between the editor's bundled TypeScript and the project's pinned version could show false-positive or false-negative type errors. This is the **only** key committed to `settings.json`: the project deliberately avoids checking in personal editor preferences (font size, theme, etc.) — `typescript.tsdk` is a narrow, deliberate exception because it's a correctness control, not a preference.

## Additional Resources

For more information on using and configuring VS Code, refer to the [official documentation](https://code.visualstudio.com/docs).
