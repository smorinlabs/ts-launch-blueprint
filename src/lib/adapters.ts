// Real-world implementations of the interactive CliDeps seams: prompt
// (@inquirer/prompts checkbox, D-016(6)), clipboard (clipboardy behind a
// dynamic import, D-016(7)), spinner (yocto-spinner, D-016(5)). All
// three render on stderr — stdout carries only the result (D-018(4,5)).
//
// This file is excluded from unit coverage as a thin I/O adapter
// (D-019(3)): each function is a one-call bridge to a real terminal
// device (TTY prompt, OS clipboard, animated stderr) that in-process
// tests replace with fakes via the deps object; the subprocess e2e tier
// exercises the non-interactive paths for real.
import yoctoSpinner from 'yocto-spinner';

import type { Project } from './api.js';

/** One selectable entry: label-for-humans / value-for-code
 * (questionary.Choice parity, projects.py:373-376). */
export interface PromptChoice {
  name: string;
  value: Project;
}

/** Interactive multi-select seam (questionary.checkbox parity). */
export type Prompter = (message: string, choices: PromptChoice[]) => Promise<Project[]>;

/** Clipboard seam (pyperclip.copy parity). */
export type ClipboardWriter = (text: string) => Promise<void>;

/** Started spinner handle. */
export interface SpinnerHandle {
  stop: () => void;
}

/** Spinner seam: create AND start a spinner (rich.Progress parity). The
 * caller owns the TTY/CI gating; factories are only invoked when the
 * spinner should actually render. */
export type SpinnerFactory = (text: string) => SpinnerHandle;

/** Real prompt: @inquirer/prompts checkbox rendered on stderr
 * (cli-standards R8.2; D-016(6)). Dynamically imported so
 * non-interactive runs never load the prompt stack. */
export const realPrompter: Prompter = async (message, choices) => {
  const { checkbox } = await import('@inquirer/prompts');
  return checkbox<Project>({ message, choices }, { output: process.stderr });
};

/** Real clipboard: clipboardy behind a dynamic import (D-016(7)). On
 * headless Linux/CI there is no display server and this rejects; the
 * projects command catches and degrades with a clear stderr error. */
export const realClipboard: ClipboardWriter = async (text) => {
  const { default: clipboard } = await import('clipboardy');
  await clipboard.write(text);
};

/** Real spinner: yocto-spinner on stderr (its default; D-016(5)). */
export const realSpinner: SpinnerFactory = (text) => {
  // Flood guard (D-033): yocto-spinner's line-clear loop divides the
  // rendered length by the stream width, so a TTY reporting 0 columns
  // (some pseudo-terminals/serial consoles) makes Math.ceil(len/0) =
  // Infinity and floods stderr with clear sequences. Treat a width-less
  // or nonsensical width as non-TTY and skip the spinner entirely.
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
