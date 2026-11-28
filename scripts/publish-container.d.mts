// Declarations for scripts/publish-container.mjs so tests/publish-container.test.ts
// satisfies root tsc --noEmit (isolatedDeclarations: true).

export interface Manifest {
  raw: Buffer;
  digest: string;
  config: string;
  mediaType: string;
}

export interface BuiltImage {
  imageId: string;
  configDigest: string;
}

export type RunFn = (
  command: string,
  args: string[],
  options?: { env?: NodeJS.ProcessEnv; inputText?: string; cwd?: string; timeoutMs?: number }
) => string;

export declare const ROOT: string;
export declare const STABLE_RE: RegExp;
export declare const DIGEST_RE: RegExp;
export declare const REVISION_RE: RegExp;
export declare const MEDIA_TYPES: string[];
export declare const INDEX_MEDIA_TYPES: string[];

export declare class HttpError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string, message?: string);
}

export declare function versionNumber(value: string): [number, number, number];
export declare function compareVersions(a: string, b: string): number;
export declare function defaultRun(
  command: string,
  args: string[],
  options?: { env?: NodeJS.ProcessEnv; inputText?: string; cwd?: string; timeoutMs?: number }
): string;
export declare function stripRedirectCredentials(
  headers: Record<string, string>
): Record<string, string>;
export declare function validateRedirectTarget(newUrl: string): URL;
export declare function fetchWithSafeRedirects(
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | Buffer;
    signal?: AbortSignal;
  },
  fetchImpl?: typeof globalThis.fetch
): Promise<{ raw: Buffer; headers: Record<string, string> }>;

export declare class Registry {
  repository: string;
  headers: Record<string, string>;
  constructor(repository: string, token: string, fetchImpl?: typeof globalThis.fetch);
  static connect(
    repository: string,
    options?: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof globalThis.fetch }
  ): Promise<Registry>;
  request(
    path: string,
    options?: { data?: Buffer; mediaType?: string }
  ): Promise<{ raw: Buffer; headers: Record<string, string> }>;
  manifest(tag: string): Promise<Manifest | null>;
  labels(manifest: Manifest): Promise<Record<string, string>>;
  versions(): Promise<string[]>;
  promote(manifest: Manifest): Promise<void>;
}

export declare function repositoryName(env?: NodeJS.ProcessEnv): string;
export declare function sourceVersion(root?: string): string;
export declare function releaseRevision(
  version: string,
  options?: { env?: NodeJS.ProcessEnv; run?: RunFn }
): string;
export declare function verifyLabels(
  labels: Record<string, string>,
  repository: string,
  version: string,
  revision?: string | null
): void;
export declare function parseTarEntries(buffer: Buffer): Map<string, Buffer>;
export declare function savedConfigDigest(image: string, directory: string, run?: RunFn): string;
export declare function smokeTest(
  imageId: string,
  version: string,
  options?: { run?: RunFn; sleepMs?: number; timeoutMs?: number }
): Promise<void>;
export declare function build(
  repository: string,
  version: string,
  revision: string,
  options?: {
    run?: RunFn;
    smoke?: (
      imageId: string,
      version: string,
      opts?: { run?: RunFn; sleepMs?: number; timeoutMs?: number }
    ) => Promise<void>;
  }
): Promise<BuiltImage>;
export declare function pullTest(
  repository: string,
  version: string,
  manifest: Manifest,
  env: NodeJS.ProcessEnv,
  options?: {
    run?: RunFn;
    smoke?: (
      imageId: string,
      version: string,
      opts?: { run?: RunFn; sleepMs?: number; timeoutMs?: number }
    ) => Promise<void>;
  }
): Promise<void>;
export declare function verifyPublic(
  repository: string,
  manifest: Manifest,
  options?: { env?: NodeJS.ProcessEnv; run?: RunFn }
): void;
export declare function publish(
  repository: string,
  version: string,
  revision: string,
  registry: Registry,
  env: NodeJS.ProcessEnv,
  effects?: {
    buildFn?: typeof build;
    run?: RunFn;
    pullTestFn?: typeof pullTest;
    verifyPublicFn?: typeof verifyPublic;
  }
): Promise<Manifest>;
export declare function promoteLatest(
  repository: string,
  registry: Registry,
  env: NodeJS.ProcessEnv,
  effects?: {
    run?: RunFn;
    pullTestFn?: typeof pullTest;
    verifyPublicFn?: typeof verifyPublic;
  }
): Promise<Manifest>;
export declare function main(options?: {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  root?: string;
  run?: RunFn;
  connectRegistry?: typeof Registry.connect;
  buildFn?: typeof build;
  publishFn?: typeof publish;
  promoteLatestFn?: typeof promoteLatest;
}): Promise<void>;
