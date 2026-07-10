# Documentation Guide

This is a plain-Markdown documentation guide: there is no Sphinx, no MyST,
and no generated site. `docs/` is a folder of GitHub-Flavored Markdown
(GFM) files that GitHub renders directly — the same files you're reading
right now. This page explains how the tree is organized, how to add a
page, and how to check your work before committing.

## Quick Start

There is no doc build step and no local server. Edit the `.md` file and
preview it however you like (your editor's Markdown preview, or just
push a branch and read it on GitHub). Before committing, run the link
checker:

```bash
just docs-check
```

This walks `README.md` and every file under `docs/` and verifies that
every relative Markdown link — a `[text]` immediately followed by
`(target)` — resolves to a file that actually exists. It never makes a
network call and never touches external URLs — see
`scripts/check-links.mjs` for the exact rules.

## Adding New Pages

1. Create a new `.md` file in the appropriate `docs/` subdirectory:

   ```bash
   touch docs/tasks/my-new-task.md
   ```

2. Write your content using standard Markdown/GFM — headings, lists,
   fenced code blocks, tables:

   ```markdown
   # My New Page Title

   This is a new documentation page.
   ```

3. Add a link to it from that directory's `index.md` (a plain bullet
   list, not a table of contents directive):

   ```markdown
   - [My New Task] (my-new-task.md) — one-line description of what it covers
   ```

   (written with a real link — `[text]` immediately followed by
   `(target)`, no space — once the page exists)

4. If the page should be discoverable from the README or another page,
   add a relative link there too, then run `just docs-check` to confirm
   it resolves.

There is no `conf.py`, no `toctree`, and no separate "build" that can
silently drop a page from the site — if it's linked from an index and
`docs-check` passes, it's wired in correctly.

## Linking Between Pages

Use relative paths, always ending in `.md` (GitHub does not do
extensionless routing the way a generated site might):

```markdown
See [Managing Dependencies](tasks/managing-dependencies.md) for details.
```

Anchors within a page use GitHub's auto-generated heading slugs
(lowercase, spaces to hyphens, punctuation stripped):

```markdown
See [Adding New Pages](#adding-new-pages) above.
```

There is no `{ref}` role and no `(label)=` target syntax to maintain —
a plain relative link plus an anchor is the whole mechanism. `just
docs-check` validates that the file side of a link resolves; it does
not resolve in-page anchors, so double-check those by eye.

## Images

Place images alongside the pages that use them (or in a shared location
under `docs/`) and reference them with standard Markdown image syntax:

```markdown
![Alt text] (./my-image.png)
```

There is no `{figure}` directive, no `_static/` convention, and no Sphinx
theme logo configuration — this template currently ships without a
project logo (a placeholder note lives where the source repo's logo
asset would have been carried; add one under `docs/` and reference it
from `README.md` when a real logo exists).

## Callouts

Use GitHub's built-in alert syntax instead of Sphinx admonitions
(`{note}`, `{warning}`, `{tip}`):

```markdown
> [!NOTE]
> This is a note.

> [!WARNING]
> This is a warning.

> [!TIP]
> This is a tip.
```

## Code Blocks with Syntax Highlighting

````markdown
```typescript
export function helloWorld(): void {
  console.log('Hello, World!');
}
```
````

## Tables

Standard GFM table syntax works as-is:

```markdown
| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |
```

## API Reference Docs

`just docs-api` generates API reference markdown from the library entry
point (`src/lib.ts`) via [TypeDoc](https://typedoc.org/), writing into
`docs/reference/api/`. It is optional and not part of `just all` or CI —
run it locally when you want generated reference pages, and commit the
output if you want it to persist. See
[docs/tools/typescript.md](./tools/typescript.md) for the toolchain
this depends on.

## Troubleshooting

Common issues and how to resolve them:

1. **A page isn't reachable from anywhere**
   - Add a link to it from the relevant `index.md`, or from `README.md`
     if it's a top-level entry point.
   - Run `just docs-check` — it only checks that link targets exist, not
     that every file is linked from somewhere, so this is a manual check.

2. **`just docs-check` reports a broken link**
   - Confirm the path is relative to the file containing the link, not
     to the repo root.
   - Confirm the target file exists and the extension (`.md`) is
     present.
   - Strip any `#anchor` fragment mentally and re-check the file part
     only — that's what the script checks.

3. **Leftover Sphinx/MyST syntax**
   - This tree should contain no `{toctree}`, `{figure}`, `{ref}`, or
     `:::` directive fences. If you find any (e.g. copying from the
     Python source template), convert it to the plain-Markdown
     equivalents described above.
