// Copy the repo-root README.md and LICENSE next to this package.json so
// `npm pack` / `npm publish` include them (npm only picks them up from the
// package's own folder). Runs as part of `build`, because pack-check and
// publish.yml pack with --ignore-scripts. The copies are gitignored.
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';

const here = import.meta.dirname;
for (const file of ['README.md', 'LICENSE']) {
  copyFileSync(join(here, '..', '..', '..', file), join(here, '..', file));
}
