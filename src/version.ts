// Single-source version (D-021(2)): read from package.json at build time and
// inlined by tsdown into the bundle. Never hardcode the version in source.
import packageJson from '../package.json' with { type: 'json' };

// Explicit annotation required by isolatedDeclarations (D-025).
export const VERSION: string = packageJson.version;
