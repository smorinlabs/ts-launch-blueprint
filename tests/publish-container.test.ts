// Behavioral guards for release replay, publication identity, and promotion
// (ported from py-launch-blueprint tests/meta/test_publish_container.py).
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  build,
  compareVersions,
  fetchWithSafeRedirects,
  HttpError,
  INDEX_MEDIA_TYPES,
  main,
  type Manifest,
  MEDIA_TYPES,
  promoteLatest,
  publish,
  pullTest,
  Registry,
  releaseRevision,
  type RunFn,
  smokeTest,
  sourceVersion,
  verifyPublic,
} from '../scripts/publish-container.mjs';

const REPOSITORY = 'example-org/service';
const REVISION = 'a'.repeat(40);
const IMAGE_ID = `sha256:${'b'.repeat(64)}`;
const CONFIG_DIGEST = `sha256:${'e'.repeat(64)}`;
const MANIFEST_DIGEST = `sha256:${'c'.repeat(64)}`;

type RequestFn = Registry['request'];
type ManifestFn = Registry['manifest'];
type LabelsFn = Registry['labels'];
type VersionsFn = Registry['versions'];
type PromoteFn = Registry['promote'];
type BuildFn = typeof build;
type PullTestFn = typeof pullTest;
type VerifyPublicFn = typeof verifyPublic;
type SmokeFn = (
  imageId: string,
  version: string,
  opts?: { run?: RunFn; sleepMs?: number; timeoutMs?: number }
) => Promise<void>;

const insecureRedirectFetch: typeof globalThis.fetch = async () =>
  new Response(null, {
    status: 307,
    headers: { location: 'http://example.com/insecure-blob' },
  });

function makeImage(
  version = '2.10.0',
  revision = REVISION,
  config = CONFIG_DIGEST
): { manifest: Manifest; labels: Record<string, string> } {
  const raw = Buffer.from(
    JSON.stringify({ mediaType: MEDIA_TYPES[0], config: { digest: config } }),
    'utf8'
  );
  const digest = `sha256:${createHash('sha256').update(raw).digest('hex')}`;
  const manifest: Manifest = {
    raw,
    digest,
    config,
    mediaType: MEDIA_TYPES[0]!,
  };
  const labels = {
    'org.opencontainers.image.source': `https://github.com/${REPOSITORY}`,
    'org.opencontainers.image.version': version,
    'org.opencontainers.image.revision': revision,
  };
  return { manifest, labels };
}

function createUstarArchive(members: Record<string, Buffer>): Buffer {
  const chunks: Buffer[] = [];
  for (const [name, data] of Object.entries(members)) {
    const header = Buffer.alloc(512, 0);
    const nameBytes = Buffer.from(name, 'utf8');
    if (nameBytes.length > 100) {
      throw new Error(`Test tar member name too long: ${name}`);
    }
    nameBytes.copy(header, 0);
    header.write('0000644\0', 100, 'ascii');
    header.write('0000000\0', 108, 'ascii');
    header.write('0000000\0', 116, 'ascii');
    header.write(`${data.length.toString(8).padStart(11, '0')}\0`, 124, 'ascii');
    header.write('00000000000\0', 136, 'ascii');
    header.write('        ', 148, 'ascii');
    header.write('0', 156, 'ascii');
    header.write('ustar\0', 257, 'ascii');
    header.write('00', 263, 'ascii');

    let sum = 0;
    for (const byte of header) {
      sum += byte;
    }
    header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 'ascii');
    chunks.push(header);

    if (data.length > 0) {
      chunks.push(data);
      const remainder = data.length % 512;
      if (remainder !== 0) {
        chunks.push(Buffer.alloc(512 - remainder, 0));
      }
    }
  }
  chunks.push(Buffer.alloc(1024, 0));
  return Buffer.concat(chunks);
}

function mockRegistry(overrides: Partial<Registry> = {}): Registry {
  return {
    repository: REPOSITORY,
    headers: {},
    request: vi.fn<RequestFn>(),
    manifest: vi.fn<ManifestFn>(),
    labels: vi.fn<LabelsFn>(),
    versions: vi.fn<VersionsFn>(),
    promote: vi.fn<PromoteFn>(),
    ...overrides,
  } as unknown as Registry;
}

describe('publish-container behavioral guards', () => {
  it('first publish pushes the tested id', async () => {
    const { manifest, labels } = makeImage();
    const registry = mockRegistry({
      manifest: vi.fn<ManifestFn>().mockResolvedValueOnce(null).mockResolvedValueOnce(manifest),
      labels: vi.fn<LabelsFn>().mockResolvedValue(labels),
    });
    const buildFn = vi
      .fn<BuildFn>()
      .mockResolvedValue({ imageId: IMAGE_ID, configDigest: CONFIG_DIGEST });
    const run = vi.fn<RunFn>().mockReturnValue('');
    const pullTestFn = vi.fn<PullTestFn>();
    const verifyPublicFn = vi.fn<VerifyPublicFn>();

    const actual = await publish(
      REPOSITORY,
      '2.10.0',
      REVISION,
      registry,
      {},
      { buildFn, run, pullTestFn, verifyPublicFn }
    );

    expect(actual).toBe(manifest);
    expect(buildFn).toHaveBeenCalledWith(REPOSITORY, '2.10.0', REVISION, { run });
    expect(run).toHaveBeenNthCalledWith(1, 'docker', [
      'tag',
      IMAGE_ID,
      `ghcr.io/${REPOSITORY}:2.10.0`,
    ]);
    expect(run).toHaveBeenNthCalledWith(
      2,
      'docker',
      ['push', '--platform=linux/amd64', `ghcr.io/${REPOSITORY}:2.10.0`],
      { env: {} }
    );
    expect(verifyPublicFn).toHaveBeenCalledWith(REPOSITORY, manifest, { env: {}, run });
  });

  it.each([IMAGE_ID, CONFIG_DIGEST])(
    'build binds config digest independently of docker storage backend (%s)',
    async (dockerId) => {
      const run: RunFn = (_cmd, args) => {
        if (args[0] === 'buildx') {
          const idx = args.indexOf('--metadata-file');
          writeFileSync(
            args[idx + 1]!,
            JSON.stringify({ 'containerimage.config.digest': CONFIG_DIGEST })
          );
          return '';
        }
        return dockerId;
      };
      const smoke = vi.fn<SmokeFn>().mockResolvedValue(undefined);

      const built = await build(REPOSITORY, '2.10.0', REVISION, { run, smoke });
      expect(built).toEqual({ imageId: dockerId, configDigest: CONFIG_DIGEST });
      expect(smoke).toHaveBeenCalledWith(dockerId, '2.10.0', { run });
    }
  );

  const containerdMetadata = {
    'buildx.build.ref': 'default/default/abc123',
    'containerimage.descriptor': {
      mediaType: MEDIA_TYPES[0],
      digest: MANIFEST_DIGEST,
      size: 476,
      platform: { architecture: 'amd64', os: 'linux' },
    },
    'containerimage.digest': MANIFEST_DIGEST,
    'image.name': `ghcr.io/${REPOSITORY}:2.10.0`,
  };

  function containerdCommands(members: Record<string, Buffer>, savedRefs: string[] = []): RunFn {
    return (_cmd, args) => {
      if (args[0] === 'buildx') {
        const idx = args.indexOf('--metadata-file');
        writeFileSync(args[idx + 1]!, JSON.stringify(containerdMetadata));
        return '';
      }
      if (args[0] === 'image' && args[1] === 'save') {
        savedRefs.push(args[args.length - 1]!);
        const idx = args.indexOf('--output');
        writeFileSync(args[idx + 1]!, createUstarArchive(members));
        return '';
      }
      return MANIFEST_DIGEST;
    };
  }

  it('build reads config digest from saved image when buildx omits it', async () => {
    const config = Buffer.from(JSON.stringify({ architecture: 'amd64', os: 'linux' }), 'utf8');
    const configDigest = `sha256:${createHash('sha256').update(config).digest('hex')}`;
    const configPath = `blobs/sha256/${configDigest.replace(/^sha256:/, '')}`;
    const members = {
      'manifest.json': Buffer.from(JSON.stringify([{ Config: configPath, Layers: [] }]), 'utf8'),
      [configPath]: config,
    };
    const smoke = vi.fn<SmokeFn>().mockResolvedValue(undefined);
    const savedRefs: string[] = [];
    const run = containerdCommands(members, savedRefs);

    const built = await build(REPOSITORY, '2.10.0', REVISION, { run, smoke });
    expect(savedRefs).toEqual([`ghcr.io/${REPOSITORY}:2.10.0`]);
    expect(built).toEqual({ imageId: MANIFEST_DIGEST, configDigest });
    expect(built.configDigest).not.toBe(MANIFEST_DIGEST);
    expect(smoke).toHaveBeenCalledWith(MANIFEST_DIGEST, '2.10.0', { run });
  });

  it.each([
    {},
    { 'manifest.json': Buffer.from('[]', 'utf8') },
    {
      'manifest.json': Buffer.from(JSON.stringify([{ Config: 'blobs/sha256/missing' }]), 'utf8'),
    },
  ])('build without any config digest names metadata keys', async (members) => {
    const smoke = vi.fn<SmokeFn>();
    let message = '';
    try {
      await build(REPOSITORY, '2.10.0', REVISION, { run: containerdCommands(members), smoke });
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toMatch(/no containerimage\.config\.digest/);
    for (const key of Object.keys(containerdMetadata)) {
      expect(message).toContain(key);
    }
    expect(smoke).not.toHaveBeenCalled();
  });

  it('digest pull resolves the daemons runnable id', async () => {
    const { manifest } = makeImage();
    const run = vi.fn<RunFn>().mockReturnValueOnce('').mockReturnValueOnce(IMAGE_ID);
    const smoke = vi.fn<SmokeFn>().mockResolvedValue(undefined);

    await pullTest(REPOSITORY, '2.10.0', manifest, {}, { run, smoke });

    expect(run).toHaveBeenLastCalledWith(
      'docker',
      ['image', 'inspect', '--format', '{{.Id}}', `ghcr.io/${REPOSITORY}@${manifest.digest}`],
      { env: {} }
    );
    expect(smoke).toHaveBeenCalledWith(IMAGE_ID, '2.10.0', { run });
  });

  it('rerun reuses existing digest without building or pushing', async () => {
    const { manifest, labels } = makeImage();
    const registry = mockRegistry({
      manifest: vi.fn<ManifestFn>().mockResolvedValue(manifest),
      labels: vi.fn<LabelsFn>().mockResolvedValue(labels),
    });
    const buildFn = vi.fn<BuildFn>();
    const run = vi.fn<RunFn>();
    const pullTestFn = vi.fn<PullTestFn>().mockResolvedValue(undefined);
    const verifyPublicFn = vi.fn<VerifyPublicFn>();

    await publish(
      REPOSITORY,
      '2.10.0',
      REVISION,
      registry,
      {},
      { buildFn, run, pullTestFn, verifyPublicFn }
    );

    expect(buildFn).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(pullTestFn).toHaveBeenCalledWith(REPOSITORY, '2.10.0', manifest, {}, { run });
  });

  it.each([
    ['org.opencontainers.image.revision', 'c'.repeat(40)],
    ['org.opencontainers.image.source', 'https://github.com/somewhere/else'],
    ['org.opencontainers.image.version', '2.9.0'],
  ])('conflicting existing %s stops before any write', async (key, value) => {
    const { manifest, labels } = makeImage();
    labels[key] = value;
    const registry = mockRegistry({
      manifest: vi.fn<ManifestFn>().mockResolvedValue(manifest),
      labels: vi.fn<LabelsFn>().mockResolvedValue(labels),
    });
    const buildFn = vi.fn<BuildFn>();
    const run = vi.fn<RunFn>();
    const pullTestFn = vi.fn<PullTestFn>();
    const verifyPublicFn = vi.fn<VerifyPublicFn>();

    await expect(
      publish(
        REPOSITORY,
        '2.10.0',
        REVISION,
        registry,
        {},
        { buildFn, run, pullTestFn, verifyPublicFn }
      )
    ).rejects.toThrow(/conflicts/);
    expect(buildFn).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(pullTestFn).not.toHaveBeenCalled();
    expect(verifyPublicFn).not.toHaveBeenCalled();
  });

  it('registry failure does not authorize a build', async () => {
    const registry = mockRegistry({
      manifest: vi.fn<ManifestFn>().mockRejectedValue(new HttpError(401, 'denied')),
    });
    const buildFn = vi.fn<BuildFn>();
    const run = vi.fn<RunFn>();

    await expect(
      publish(REPOSITORY, '2.10.0', REVISION, registry, {}, { buildFn, run })
    ).rejects.toThrow(HttpError);
    expect(buildFn).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it('push with different config is not accepted', async () => {
    const { manifest } = makeImage('2.10.0', REVISION, `sha256:${'d'.repeat(64)}`);
    const registry = mockRegistry({
      manifest: vi.fn<ManifestFn>().mockResolvedValueOnce(null).mockResolvedValueOnce(manifest),
    });
    const buildFn = vi
      .fn<BuildFn>()
      .mockResolvedValue({ imageId: IMAGE_ID, configDigest: CONFIG_DIGEST });
    const run = vi.fn<RunFn>().mockReturnValue('');
    const verifyPublicFn = vi.fn<VerifyPublicFn>();

    await expect(
      publish(REPOSITORY, '2.10.0', REVISION, registry, {}, { buildFn, run, verifyPublicFn })
    ).rejects.toThrow(/exact smoke-tested image/);
    expect(verifyPublicFn).not.toHaveBeenCalled();
  });

  it.each([
    [404, 'MANIFEST_UNKNOWN'],
    [404, 'NAME_UNKNOWN'],
  ])('status=%d code=%s allows publication (returns null)', async (status, code) => {
    const registry = new Registry(REPOSITORY, 'tok');
    registry.request = vi
      .fn<RequestFn>()
      .mockRejectedValue(new HttpError(status, JSON.stringify({ errors: [{ code }] })));

    await expect(registry.manifest('2.10.0')).resolves.toBeNull();
  });

  it.each([
    [404, 'UNAUTHORIZED'],
    [403, 'DENIED'],
    [401, 'UNAUTHORIZED'],
    [500, 'MANIFEST_UNKNOWN'],
  ])('status=%d code=%s fails closed (rethrows HttpError)', async (status, code) => {
    const registry = new Registry(REPOSITORY, 'tok');
    registry.request = vi
      .fn<RequestFn>()
      .mockRejectedValue(new HttpError(status, JSON.stringify({ errors: [{ code }] })));

    await expect(registry.manifest('2.10.0')).rejects.toThrow(HttpError);
  });

  it('manifest digest is verified against received bytes', async () => {
    const { manifest } = makeImage();
    const registry = new Registry(REPOSITORY, 'tok');
    registry.request = vi
      .fn<RequestFn>()
      .mockResolvedValueOnce({
        raw: manifest.raw,
        headers: { 'docker-content-digest': manifest.digest },
      })
      .mockResolvedValueOnce({
        raw: manifest.raw,
        headers: { 'docker-content-digest': IMAGE_ID },
      });

    await expect(registry.manifest('2.10.0')).resolves.toEqual(manifest);
    await expect(registry.manifest('2.10.0')).rejects.toThrow(/digest does not match/);
  });

  it('manifest falls back to Content-Type header when optional OCI doc.mediaType is omitted', async () => {
    const raw = Buffer.from(
      JSON.stringify({ schemaVersion: 2, config: { digest: CONFIG_DIGEST } }),
      'utf8'
    );
    const digest = `sha256:${createHash('sha256').update(raw).digest('hex')}`;
    const registry = new Registry(REPOSITORY, 'tok');
    registry.request = vi.fn<RequestFn>().mockResolvedValueOnce({
      raw,
      headers: {
        'docker-content-digest': digest,
        'content-type': 'application/vnd.oci.image.manifest.v1+json; charset=utf-8',
      },
    });

    await expect(registry.manifest('2.10.0')).resolves.toEqual({
      raw,
      digest,
      config: CONFIG_DIGEST,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
    });
  });

  it('existing index is detected and refused, not mistaken for absence', async () => {
    const raw = Buffer.from(
      JSON.stringify({ mediaType: INDEX_MEDIA_TYPES[0], manifests: [] }),
      'utf8'
    );
    const digest = `sha256:${createHash('sha256').update(raw).digest('hex')}`;

    const fetchImpl: typeof globalThis.fetch = async (_input, init) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const accept = headers.Accept ?? '';
      if (!accept.includes(INDEX_MEDIA_TYPES[0]!)) {
        return new Response(JSON.stringify({ errors: [{ code: 'MANIFEST_UNKNOWN' }] }), {
          status: 404,
        });
      }
      return new Response(raw, {
        status: 200,
        headers: { 'Docker-Content-Digest': digest },
      });
    };

    const registry = new Registry(REPOSITORY, 'tok', fetchImpl);
    await expect(registry.manifest('2.10.0')).rejects.toThrow(/single-platform/);
  });

  it('versions are numeric, stable, and paginated (including relative query Link)', async () => {
    const registry = new Registry(REPOSITORY, 'tok');
    registry.request = vi
      .fn<RequestFn>()
      .mockResolvedValueOnce({
        raw: Buffer.from(
          JSON.stringify({ tags: ['2.9.0', '2.10.0-rc.1', 'latest', '02.0.0'] }),
          'utf8'
        ),
        headers: { link: '<?n=1000&last=2.9.0>; rel="next"' },
      })
      .mockResolvedValueOnce({
        raw: Buffer.from(JSON.stringify({ tags: ['2.10.0', '1.0.0'] }), 'utf8'),
        headers: {},
      });

    await expect(registry.versions()).resolves.toEqual(['1.0.0', '2.9.0', '2.10.0']);
    expect(registry.request).toHaveBeenNthCalledWith(1, `/v2/${REPOSITORY}/tags/list?n=1000`);
    expect(registry.request).toHaveBeenNthCalledWith(
      2,
      `/v2/${REPOSITORY}/tags/list?n=1000&last=2.9.0`
    );
  });

  it('compareVersions compares large version components without Number rounding', () => {
    expect(compareVersions('2.9.0', '2.10.0')).toBeLessThan(0);
    expect(compareVersions('9007199254740993.0.0', '9007199254740992.0.0')).toBeGreaterThan(0);
  });

  it('registry pagination cannot send credentials to another host', async () => {
    const registry = new Registry(REPOSITORY, 'tok');
    await expect(registry.request('https://example.com/steal')).rejects.toThrow(/leave ghcr\.io/);
  });

  it('blob redirect strips registry credentials and requires HTTPS', async () => {
    const seenHeaders: Record<string, string>[] = [];
    const fetchImpl: typeof globalThis.fetch = async (url, init) => {
      seenHeaders.push({ ...(init?.headers as Record<string, string>) });
      if (String(url).startsWith('https://ghcr.io/')) {
        return new Response(null, {
          status: 307,
          headers: { location: 'https://pkg-containers.githubusercontent.com/signed-blob' },
        });
      }
      return new Response('blob-ok', { status: 200 });
    };

    const res = await fetchWithSafeRedirects(
      `https://ghcr.io/v2/${REPOSITORY}/blobs/sha256:abc`,
      { headers: { Authorization: 'Bearer test-only', 'Proxy-Authorization': 'Basic x' } },
      fetchImpl
    );
    expect(res.raw.toString('utf8')).toBe('blob-ok');
    expect(seenHeaders[0]?.Authorization).toBe('Bearer test-only');
    expect(seenHeaders[1]?.Authorization).toBeUndefined();
    expect(seenHeaders[1]?.['Proxy-Authorization']).toBeUndefined();

    await expect(
      fetchWithSafeRedirects(
        `https://ghcr.io/v2/${REPOSITORY}/blobs/sha256:abc`,
        {},
        insecureRedirectFetch
      )
    ).rejects.toThrow(/requires HTTPS/);
  });

  it('fetchWithSafeRedirects attaches a default timeout signal and preserves a caller signal', async () => {
    const signals: (AbortSignal | undefined)[] = [];
    const fetchImpl: typeof globalThis.fetch = async (_url, init) => {
      signals.push(init?.signal ?? undefined);
      return new Response('ok', { status: 200 });
    };

    await fetchWithSafeRedirects(`https://ghcr.io/v2/${REPOSITORY}/tags/list`, {}, fetchImpl);
    expect(signals[0]).toBeInstanceOf(AbortSignal);

    const controller = new AbortController();
    await fetchWithSafeRedirects(
      `https://ghcr.io/v2/${REPOSITORY}/tags/list`,
      { signal: controller.signal },
      fetchImpl
    );
    expect(signals[1]).toBe(controller.signal);
  });

  it('old promotion selects the highest published version', async () => {
    const { manifest: newest, labels } = makeImage('2.10.0');
    const registry = mockRegistry({
      versions: vi.fn<VersionsFn>().mockResolvedValue(['2.9.0', '2.10.0']),
      manifest: vi.fn<ManifestFn>().mockResolvedValueOnce(newest).mockResolvedValueOnce(null),
      labels: vi.fn<LabelsFn>().mockResolvedValue(labels),
      promote: vi.fn<PromoteFn>().mockResolvedValue(undefined),
    });
    const run = vi.fn<RunFn>();
    const pullTestFn = vi.fn<PullTestFn>().mockResolvedValue(undefined);
    const verifyPublicFn = vi.fn<VerifyPublicFn>();

    await expect(
      promoteLatest(REPOSITORY, registry, {}, { run, pullTestFn, verifyPublicFn })
    ).resolves.toBe(newest);
    expect(registry.manifest).toHaveBeenCalledWith('2.10.0');
    expect(registry.promote).toHaveBeenCalledWith(newest);
    expect(pullTestFn).toHaveBeenCalledWith(REPOSITORY, '2.10.0', newest, {}, { run });
  });

  it.each(['3.0.0', '2.10.0'])(
    'latest does not regress or replace conflicting bytes (current=%s)',
    async (currentVersion) => {
      const { manifest: candidate, labels: candidateLabels } = makeImage();
      const { manifest: current, labels: currentLabels } = makeImage(
        currentVersion,
        REVISION,
        `sha256:${'c'.repeat(64)}`
      );
      const registry = mockRegistry({
        versions: vi.fn<VersionsFn>().mockResolvedValue(['2.10.0']),
        manifest: vi
          .fn<ManifestFn>()
          .mockResolvedValueOnce(candidate)
          .mockResolvedValueOnce(current),
        labels: vi
          .fn<LabelsFn>()
          .mockResolvedValueOnce(candidateLabels)
          .mockResolvedValueOnce(currentLabels),
        promote: vi.fn<PromoteFn>(),
      });

      await expect(promoteLatest(REPOSITORY, registry, {})).rejects.toThrow(/backward|conflicts/);
      expect(registry.promote).not.toHaveBeenCalled();
    }
  );

  it('promotion copies manifest bytes without wrapping in an index', async () => {
    const { manifest } = makeImage();
    const registry = new Registry(REPOSITORY, 'tok');
    registry.request = vi.fn<RequestFn>().mockResolvedValue({ raw: Buffer.alloc(0), headers: {} });
    registry.manifest = vi.fn<ManifestFn>().mockResolvedValue(manifest);

    await registry.promote(manifest);

    expect(registry.request).toHaveBeenCalledWith(`/v2/${REPOSITORY}/manifests/latest`, {
      data: manifest.raw,
      mediaType: manifest.mediaType,
    });
  });

  it('public check uses an isolated temporary docker configuration without inherited auth', () => {
    const { manifest } = makeImage();
    const directories: string[] = [];
    const run: RunFn = (cmd, args, options) => {
      const directory = options?.env?.DOCKER_CONFIG;
      expect(directory).toBeTypeOf('string');
      expect(options?.env?.DOCKER_AUTH_CONFIG).toBeUndefined();
      directories.push(directory!);
      expect(readdirSync(directory!)).toEqual(['config.json']);
      expect(readFileSync(join(directory!, 'config.json'), 'utf8')).toBe('{"auths":{}}\n');
      expect([cmd, ...args]).toEqual([
        'docker',
        'pull',
        '--platform=linux/amd64',
        `ghcr.io/${REPOSITORY}@${manifest.digest}`,
      ]);
      return '';
    };

    verifyPublic(REPOSITORY, manifest, { env: { DOCKER_AUTH_CONFIG: '{"auths":{}}' }, run });
    expect(directories).toHaveLength(1);
    expect(existsSync(directories[0]!)).toBe(false);
  });

  it('release validation checks tag, commit, and main ancestry', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ghcr-release-'));
    try {
      const eventPath = join(dir, 'event.json');
      writeFileSync(
        eventPath,
        JSON.stringify({
          action: 'published',
          release: { draft: false, prerelease: false, tag_name: 'v2.10.0' },
        })
      );
      const run = vi.fn<RunFn>().mockReturnValue(REVISION);
      const env = {
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_EVENT_NAME: 'release',
        GITHUB_REF: 'refs/tags/v2.10.0',
        GITHUB_SHA: REVISION,
      };

      expect(releaseRevision('2.10.0', { env, run })).toBe(REVISION);
      expect(run).toHaveBeenCalledWith('git', ['rev-parse', 'refs/tags/v2.10.0^{commit}']);
      expect(run).toHaveBeenCalledWith('git', [
        'merge-base',
        '--is-ancestor',
        REVISION,
        'refs/remotes/origin/main',
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.each([
    ['draft', true],
    ['prerelease', true],
    ['tag_name', 'v2.9.0'],
  ])('invalid release metadata (%s=%j) is refused', (field, value) => {
    const dir = mkdtempSync(join(tmpdir(), 'ghcr-release-'));
    try {
      const eventPath = join(dir, 'event.json');
      const release: Record<string, unknown> = {
        draft: false,
        prerelease: false,
        tag_name: 'v2.10.0',
      };
      release[field] = value;
      writeFileSync(eventPath, JSON.stringify({ action: 'published', release }));
      const run = vi.fn<RunFn>();
      const env = {
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_EVENT_NAME: 'release',
        GITHUB_REF: 'refs/tags/v2.10.0',
        GITHUB_SHA: REVISION,
      };

      expect(() => releaseRevision('2.10.0', { env, run })).toThrow(/matching published stable/);
      expect(run).not.toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('moved tag is refused', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ghcr-release-'));
    try {
      const eventPath = join(dir, 'event.json');
      writeFileSync(
        eventPath,
        JSON.stringify({
          action: 'published',
          release: { draft: false, prerelease: false, tag_name: 'v2.10.0' },
        })
      );
      const run = vi.fn<RunFn>().mockReturnValueOnce(REVISION).mockReturnValueOnce('d'.repeat(40));
      const env = {
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_EVENT_NAME: 'release',
        GITHUB_REF: 'refs/tags/v2.10.0',
        GITHUB_SHA: REVISION,
      };

      expect(() => releaseRevision('2.10.0', { env, run })).toThrow(/disagree/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('PR cannot enter publishing even if workflow gate is removed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ghcr-release-'));
    try {
      const eventPath = join(dir, 'event.json');
      writeFileSync(
        eventPath,
        JSON.stringify({
          action: 'published',
          release: { draft: false, prerelease: false, tag_name: 'v0.1.3' },
        })
      );
      const connectRegistry = vi.fn<typeof Registry.connect>();
      const env = {
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_EVENT_NAME: 'pull_request',
        GITHUB_REPOSITORY: REPOSITORY,
        GITHUB_REF: 'refs/tags/v0.1.3',
        GITHUB_SHA: REVISION,
      };

      await expect(
        main({
          argv: ['publish'],
          env,
          connectRegistry,
          run: vi.fn<RunFn>().mockReturnValue(REVISION),
        })
      ).rejects.toThrow(/matching published stable/);
      expect(connectRegistry).not.toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('sourceVersion reads repo version and verifies root, core, CLI, and manifest parity', () => {
    expect(sourceVersion()).toMatch(/^\d+\.\d+\.\d+$/);

    const dir = mkdtempSync(join(tmpdir(), 'ghcr-version-'));
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '1.2.3' }), 'utf8');
      writeFileSync(
        join(dir, '.release-please-manifest.json'),
        JSON.stringify({ '.': '1.2.3' }),
        'utf8'
      );
      const coreDir = join(dir, 'packages', 'core');
      mkdirSync(coreDir, { recursive: true });
      writeFileSync(join(coreDir, 'package.json'), JSON.stringify({ version: '0.9.9' }), 'utf8');
      expect(() => sourceVersion(dir)).toThrow(/packages\/core\/package\.json version/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('smokeTest validates non-root uid, health version, passes remaining timeoutMs, and cleans up container', async () => {
    const runOk = vi
      .fn<RunFn>()
      .mockReturnValueOnce('container-123')
      .mockReturnValueOnce(
        JSON.stringify({ health: { status: 'ok', version: '2.10.0' }, uid: 1000 })
      )
      .mockReturnValueOnce('');
    await smokeTest(IMAGE_ID, '2.10.0', { run: runOk, sleepMs: 0, timeoutMs: 5_000 });
    expect(runOk).toHaveBeenNthCalledWith(
      2,
      'docker',
      ['exec', 'container-123', 'node', '-e', expect.any(String)],
      { timeoutMs: expect.any(Number) }
    );
    expect(runOk).toHaveBeenLastCalledWith('docker', ['rm', '--force', 'container-123']);

    const runRoot = vi
      .fn<RunFn>()
      .mockReturnValueOnce('container-456')
      .mockReturnValueOnce(JSON.stringify({ health: { status: 'ok', version: '2.10.0' }, uid: 0 }))
      .mockReturnValueOnce('');
    await expect(smokeTest(IMAGE_ID, '2.10.0', { run: runRoot, sleepMs: 0 })).rejects.toThrow(
      /runs as root/
    );
    expect(runRoot).toHaveBeenLastCalledWith('docker', ['rm', '--force', 'container-456']);
  });

  it('main forwards injected run to publishFn and promoteLatestFn with isolated docker config', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ghcr-main-'));
    try {
      const eventPath = join(dir, 'event.json');
      const version = sourceVersion();
      writeFileSync(
        eventPath,
        JSON.stringify({
          action: 'published',
          release: { draft: false, prerelease: false, tag_name: `v${version}` },
        })
      );
      const { manifest } = makeImage(version);
      const run = vi.fn<RunFn>().mockReturnValue(REVISION);
      const connectRegistry = vi.fn<typeof Registry.connect>().mockResolvedValue(mockRegistry());
      const publishFn = vi.fn<typeof publish>().mockResolvedValue(manifest);
      const promoteLatestFn = vi.fn<typeof promoteLatest>().mockResolvedValue(manifest);
      const env = {
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_EVENT_NAME: 'release',
        GITHUB_REPOSITORY: REPOSITORY,
        GITHUB_REF: `refs/tags/v${version}`,
        GITHUB_SHA: REVISION,
        GITHUB_ACTOR: 'publisher',
        GHCR_TOKEN: 'tok',
      };

      await main({
        argv: ['publish'],
        env,
        run,
        connectRegistry,
        publishFn,
        promoteLatestFn,
      });
      expect(publishFn).toHaveBeenCalledWith(
        REPOSITORY,
        version,
        REVISION,
        expect.any(Object),
        expect.objectContaining({ DOCKER_CONFIG: expect.any(String) }),
        { run }
      );

      await main({
        argv: ['promote'],
        env,
        run,
        connectRegistry,
        publishFn,
        promoteLatestFn,
      });
      expect(promoteLatestFn).toHaveBeenCalledWith(
        REPOSITORY,
        expect.any(Object),
        expect.objectContaining({ DOCKER_CONFIG: expect.any(String) }),
        { run }
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
