# ts-launch-blueprint-core

Standalone TypeScript domain core library (Zod schemas, repositories, domain errors, and services) with zero CLI, HTTP-framework, or browser-UI dependencies.

- **ESM-only** (`"type": "module"`, Node.js `>= 24`)
- **Tree-shakeable** (`"sideEffects": false`)
- **Minimal dependencies**: runtime dependency on `zod` only
- **Typed end-to-end**: strict TypeScript declarations (`.d.ts`) and JS sourcemaps

## Installation

```bash
pnpm add ts-launch-blueprint-core
# or
npm install ts-launch-blueprint-core
```

## Usage

### In-memory data source (zero network, built-in demo seed)

```ts
import { createCore, VERSION } from 'ts-launch-blueprint-core';

const core = createCore({ source: 'memory' });
const { projects, nextCursor } = await core.projects.listProjects({
  workspaceName: 'Engineering',
  limit: 10,
});

console.log(`core v${VERSION}:`, projects, nextCursor);
```

### HTTP data source (injected `fetch` transport)

```ts
import { AuthError, createCore, ProjectNotFoundError } from 'ts-launch-blueprint-core';

const core = createCore({
  source: 'http',
  http: {
    token: process.env.API_TOKEN ?? '',
    fetchImpl: fetch,
    baseUrl: 'https://api.example.com/1.0',
  },
});

try {
  const project = await core.projects.getProject('p-1');
  console.log(project.name);
} catch (error) {
  if (error instanceof ProjectNotFoundError) {
    console.error(`Missing project (${error.code}): ${error.message}`);
  } else if (error instanceof AuthError) {
    console.error(`Authentication failed (${error.code}): ${error.message}`);
  } else {
    throw error;
  }
}
```

### Validation contracts

Use the exported Zod schemas (`ListProjectsInputSchema`, `ListProjectsOutputSchema`, `GetProjectInputSchema`, `GetProjectOutputSchema`) to validate controller inputs and outputs against the core contract.

## License

MIT — see [LICENSE](./LICENSE).
