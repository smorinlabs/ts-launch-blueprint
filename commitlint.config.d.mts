// Declarations for commitlint.config.mjs so the repo-hygiene meta-test can
// import the real config under tsc's noImplicitAny gate.
export interface CommitlintConfig {
  extends: string[];
  rules: {
    'type-enum': [number, string, string[]];
    'header-max-length': [number, string, number];
    'body-max-line-length': [number, string, number];
  };
}

declare const config: CommitlintConfig;
export default config;
