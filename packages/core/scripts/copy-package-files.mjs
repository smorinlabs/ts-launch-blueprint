// Copy the repo-root LICENSE next to this package.json so `pnpm pack` includes
// it alongside the package's dedicated README.md (packers only pick up LICENSE
// from the package's own folder). Runs as part of `build`; the copy is gitignored.
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';

const here = import.meta.dirname;
copyFileSync(join(here, '..', '..', '..', 'LICENSE'), join(here, '..', 'LICENSE'));
