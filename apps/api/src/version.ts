// Static JSON import so tsdown inlines the root workspace version into
// dist/server.js while keeping apps/api/package.json versionless (D-048(7)).
import rootPackageJson from '../../../package.json' with { type: 'json' };

/** The workspace version, inlined into the API bundle at build time. */
export const VERSION: string = rootPackageJson.version;
