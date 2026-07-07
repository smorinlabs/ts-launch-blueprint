// Commit-message contract (D-020(2,4)): config-conventional defaults are
// header 100 / body-line 100; the source's .gitlint contract is 50/72, so all
// three rules are explicit overrides.
//
// Reconciled type list: the source's .gitlint allowed
// feat,fix,docs,style,refactor,test,chore,ci,build,perf while .gitmessage
// listed only 7 (missing ci, build, perf) — an internal inconsistency the port
// fixes. `revert` is admitted on top of the source list per D-020(2)'s
// recommendation (release-please understands it). .gitmessage carries the
// IDENTICAL list; tests/repo-hygiene.test.ts enforces exact equality.
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
    'header-max-length': [2, 'always', 50],
    'body-max-line-length': [2, 'always', 72],
  },
};
