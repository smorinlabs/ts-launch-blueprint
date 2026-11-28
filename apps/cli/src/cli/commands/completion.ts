// `ts-projects completion {bash,zsh,fish}` shell completion generator.
// Identifiers derive dynamically from TOOL_DIR_NAME so template-press rebranding
// produces zero leaked tokens.
// cspell:ignore cword CWORD COMPREPLY compgen nosort compdef funcstack
import { writeFileSync } from 'node:fs';

import { Argument, type Command } from 'commander';

import type { CliContext, CliDeps } from '../deps.js';
import { TOOL_DIR_NAME } from '../xdg-paths.js';

/** Supported shell targets for `completion <shell>`. */
export const COMPLETION_SHELLS: readonly ['bash', 'zsh', 'fish'] = ['bash', 'zsh', 'fish'] as const;

/** Union of supported completion shells. */
export type CompletionShell = (typeof COMPLETION_SHELLS)[number];

/** Build a shell completion script for the given shell target. */
export function renderCompletionScript(shell: CompletionShell): string {
  const bin = TOOL_DIR_NAME;
  const fnName = `_${bin.replaceAll('-', '_')}_completion`;
  const envPrefix = bin.toUpperCase().replaceAll('-', '_');
  const setupFn = `${fnName}_setup`;
  const completeEnv = `_${envPrefix}_COMPLETE`;

  if (shell === 'bash') {
    return [
      `# bash completion for ${bin}`,
      `${fnName}() {`,
      '    local cur prev words cword',
      '    cur="${COMP_WORDS[COMP_CWORD]}"',
      '    prev="${COMP_WORDS[COMP_CWORD-1]}"',
      '    local top_cmds="projects config doctor completion"',
      '    local projects_cmds="list get"',
      '    local config_cmds="init path get set"',
      '    local shells="bash zsh fish"',
      '    local global_opts="-o --output --json --output-file --log-level --log-file -v --verbose -q --quiet --debug --no-color --no-input --config --token -V --version -h --help"',
      '',
      '    if [[ ${COMP_CWORD} -eq 1 ]]; then',
      '        COMPREPLY=( $(compgen -W "${top_cmds} ${global_opts}" -- "${cur}") )',
      '        return 0',
      '    fi',
      '    case "${COMP_WORDS[1]}" in',
      '        projects)',
      '            if [[ ${COMP_CWORD} -eq 2 ]]; then',
      '                COMPREPLY=( $(compgen -W "${projects_cmds}" -- "${cur}") )',
      '            else',
      '                COMPREPLY=( $(compgen -W "--workspace --limit --source --copy ${global_opts}" -- "${cur}") )',
      '            fi',
      '            ;;',
      '        config)',
      '            if [[ ${COMP_CWORD} -eq 2 ]]; then',
      '                COMPREPLY=( $(compgen -W "${config_cmds}" -- "${cur}") )',
      '            elif [[ "${COMP_WORDS[2]}" == "get" && ${COMP_CWORD} -eq 3 ]]; then',
      '                COMPREPLY=( $(compgen -W "logging.file logging.file_level logging.format logging.level output.color output.format token" -- "${cur}") )',
      '            elif [[ "${COMP_WORDS[2]}" == "set" && ${COMP_CWORD} -eq 3 ]]; then',
      '                COMPREPLY=( $(compgen -W "logging.file logging.file_level logging.format logging.level output.color output.format" -- "${cur}") )',
      '            else',
      '                COMPREPLY=( $(compgen -W "--dry-run -y --yes ${global_opts}" -- "${cur}") )',
      '            fi',
      '            ;;',
      '        doctor)',
      '            COMPREPLY=( $(compgen -W "--bundle ${global_opts}" -- "${cur}") )',
      '            ;;',
      '        completion)',
      '            COMPREPLY=( $(compgen -W "${shells}" -- "${cur}") )',
      '            ;;',
      '    esac',
      '    return 0',
      '}',
      '',
      `${setupFn}() {`,
      `    complete -o nosort -F ${fnName} ${bin}`,
      '}',
      '',
      `# ${completeEnv}`,
      `${setupFn}`,
      '',
    ].join('\n');
  }

  if (shell === 'zsh') {
    return [
      `#compdef ${bin}`,
      '',
      `${fnName}() {`,
      '    local -a commands',
      '    commands=(',
      "        'projects:list and inspect projects'",
      "        'config:inspect and edit CLI configuration'",
      "        'doctor:check environment and configuration health'",
      "        'completion:generate shell completion scripts'",
      '    )',
      '    _arguments -C \\',
      "        '-o[Output format]:format:(text json csv markdown)' \\",
      "        '--output[Output format]:format:(text json csv markdown)' \\",
      "        '--json[Shorthand for --output json]' \\",
      "        '--output-file[Write results to file]:file:_files' \\",
      "        '1:command:->cmds' \\",
      "        '*::arg:->args'",
      '    case "$state" in',
      '        cmds)',
      `            _describe -t commands '${bin} commands' commands`,
      '            ;;',
      '    esac',
      '}',
      '',
      `if [ "\${funcstack[1]}" = "${fnName}" ]; then`,
      `    ${fnName} "$@"`,
      'else',
      `    compdef ${fnName} ${bin}`,
      'fi',
      '',
    ].join('\n');
  }

  return [
    `# fish completion for ${bin}`,
    `function ${fnName}`,
    '    set -l cmd (commandline -opc)',
    '    if test (count $cmd) -eq 1',
    '        printf "%s\\n" projects config doctor completion',
    '    else if test "$cmd[2]" = "projects"',
    '        printf "%s\\n" list get',
    '    else if test "$cmd[2]" = "config"',
    '        printf "%s\\n" init path get set',
    '    else if test "$cmd[2]" = "completion"',
    '        printf "%s\\n" bash zsh fish',
    '    end',
    'end',
    '',
    `complete --no-files --command ${bin} --arguments "(${fnName})"`,
    '',
  ].join('\n');
}

/** Register the `completion <shell>` command. */
export function registerCompletionCommand(
  program: Command,
  deps: CliDeps,
  initContext: (commandPath: string) => CliContext
): void {
  program
    .command('completion')
    .description('generate shell completion script (bash, zsh, fish)')
    .addArgument(new Argument('<shell>', 'target shell').choices(COMPLETION_SHELLS))
    .action((shell: CompletionShell) => {
      const ctx = initContext('completion');
      const script = renderCompletionScript(shell);
      if (ctx.outputFile !== undefined) {
        if (deps.fs !== undefined) {
          deps.fs.writeFileSync(ctx.outputFile, script, {});
        } else {
          writeFileSync(ctx.outputFile, script, 'utf8');
        }
        ctx.message(ctx.colors.success(`Results written to ${ctx.outputFile}`));
      } else {
        deps.stdout(script);
      }
    });
}
