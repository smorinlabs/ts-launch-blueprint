// Commit-message contract (Q9.A, superseding D-020(2) 50/72 limits):
// header 100 / body-line 200 / footer-line 200. The 200-char body/footer caps
// accommodate docs URLs, GitHub action permalinks, and long identifier strings
// while still flagging genuinely unbounded paragraphs.
//
// Dependabot PRs use a separate, laxer config
// (commitlint.dependabot.config.mjs) because dependabot embeds full
// release-notes / comparison URLs in its body that frequently exceed 200
// chars. See .github/workflows/commitlint.yml for the per-author split.
//
// .gitmessage carries the IDENTICAL type-enum list; tests/repo-hygiene.test.ts
// enforces exact equality.
const types = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'test',
  'chore',
  'ci',
  'build',
  'perf',
  'revert',
];

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', types],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 200],
    'footer-max-line-length': [2, 'always', 200],
  },
};
