// Prevent accidental bare `npm publish` inside packages/core.
//
// packages/core/package.json keeps live TypeScript paths in top-level `exports`
// for zero-build workspace development and puts the built `./dist/*` paths in
// `publishConfig.exports`. `pnpm pack` (and `pnpm publish`) rewrites `exports`
// from `publishConfig.exports`, whereas bare `npm publish` ignores
// `publishConfig.exports` and would publish raw `./src/index.ts` paths.
//
// Publishing via `pnpm pack` + `npm publish <tarball>` does not invoke
// `prepublishOnly`, so the OIDC Trusted Publishing path succeeds cleanly while
// bare `npm publish` in this folder fails fast with instructions.
const execPath = process.env['npm_execpath'] ?? '';
if (!/pnpm(?:\.[a-z]+)?$/i.test(execPath)) {
  console.error(
    'Refusing bare npm publish from packages/core because npm ignores publishConfig.exports.\n' +
      'Pack with `pnpm pack` first (which rewrites exports to ./dist/*), then run `npm publish <tarball> --access public`.'
  );
  process.exit(1);
}
