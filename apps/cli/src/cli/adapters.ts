import { spawnSync } from 'node:child_process';

import type { Project } from '@ts-launch-blueprint/core';
// Real-world implementations of the interactive CliDeps seams: prompt
// (@inquirer/prompts), clipboard (clipboardy), spinner (yocto-spinner),
// and pager (spawnSync). All interactive prompts render on stderr — stdout
// carries only the result (D-018(4,5)).
//
// This file is excluded from unit coverage as a thin I/O adapter
// (D-019(3)): each function is a one-call bridge to a real terminal
// device or subprocess that in-process tests replace with fakes via CliDeps.
import yoctoSpinner from 'yocto-spinner';

/** One selectable entry: label-for-humans / value-for-code. */
export interface PromptChoice {
  name: string;
  value: Project;
}

/** Interactive multi-select seam (questionary.checkbox parity). */
export type Prompter = (message: string, choices: PromptChoice[]) => Promise<Project[]>;

/** Interactive single-choice or free-form prompt seam for `config init`. */
export type ChoicePrompter = (
  message: string,
  choices: readonly string[],
  defaultValue: string
) => Promise<string>;

/** Interactive yes/no confirmation prompt seam for `config set`. */
export type ConfirmPrompter = (message: string, defaultValue?: boolean) => Promise<boolean>;

/** Pager subprocess runner seam; returns true if pager launched cleanly. */
export type PagerRunner = (argv: string[], input: string) => boolean;

/** Clipboard seam (pyperclip.copy parity). */
export type ClipboardWriter = (text: string) => Promise<void>;

/** Started spinner handle. */
export interface SpinnerHandle {
  stop: () => void;
}

/** Spinner seam: create AND start a spinner (rich.Progress parity). */
export type SpinnerFactory = (text: string) => SpinnerHandle;

/** Real prompt: @inquirer/prompts checkbox rendered on stderr. */
export const realPrompter: Prompter = async (message, choices) => {
  const { checkbox } = await import('@inquirer/prompts');
  return checkbox<Project>({ message, choices }, { output: process.stderr });
};

/** Real choice prompt for `config init`: @inquirer/prompts select/input on stderr. */
export const realChoicePrompter: ChoicePrompter = async (message, choices, defaultValue) => {
  if (choices.length > 0) {
    const { select } = await import('@inquirer/prompts');
    return select<string>(
      {
        message,
        choices: choices.map((c) => ({ name: c, value: c })),
        default: defaultValue,
      },
      { output: process.stderr }
    );
  }
  const { input } = await import('@inquirer/prompts');
  return input({ message, default: defaultValue }, { output: process.stderr });
};

/** Real confirmation prompt for `config set`: @inquirer/prompts confirm on stderr. */
export const realConfirmPrompter: ConfirmPrompter = async (message, defaultValue = false) => {
  const { confirm } = await import('@inquirer/prompts');
  return confirm({ message, default: defaultValue }, { output: process.stderr });
};

/** Real pager subprocess runner via `spawnSync`. */
export const realPager: PagerRunner = (argv, input) => {
  const cmd = argv[0];
  if (cmd === undefined || cmd === '') {
    return false;
  }
  const result = spawnSync(cmd, argv.slice(1), {
    input,
    stdio: ['pipe', 'inherit', 'inherit'],
    encoding: 'utf8',
  });
  return result.error === undefined;
};

/** Real clipboard: clipboardy behind a dynamic import. */
export const realClipboard: ClipboardWriter = async (text) => {
  const { default: clipboard } = await import('clipboardy');
  await clipboard.write(text);
};

/** Real spinner: yocto-spinner on stderr with 0-column flood guard. */
export const realSpinner: SpinnerFactory = (text) => {
  const columns = process.stderr.columns;
  if (!Number.isFinite(columns) || columns <= 0) {
    return { stop: () => undefined };
  }
  const spinner = yoctoSpinner({ text, stream: process.stderr }).start();
  return {
    stop: () => {
      spinner.stop();
    },
  };
};
