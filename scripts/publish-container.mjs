#!/usr/bin/env node
// Build, verify, and publish the API container image without rebuilding
// released versions. Registry errors fail closed; only an explicit
// missing-manifest response permits a new version to be built.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const STABLE_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
export const REVISION_RE = /^[0-9a-f]{40}$/;

export const MEDIA_TYPES = [
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.v2+json',
];
export const INDEX_MEDIA_TYPES = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
];

export class HttpError extends Error {
  constructor(status, body, message = `HTTP ${status}`) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

export function versionNumber(value) {
  const match = STABLE_RE.exec(value);
  if (match === null) {
    throw new Error(`Expected a stable X.Y.Z version, got ${JSON.stringify(value)}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareVersions(a, b) {
  const va = versionNumber(a);
  const vb = versionNumber(b);
  for (let i = 0; i < 3; i += 1) {
    if (va[i] !== vb[i]) {
      return va[i] - vb[i];
    }
  }
  return 0;
}

export function defaultRun(command, args, options = {}) {
  const { env = process.env, inputText = undefined, cwd = ROOT } = options;
  try {
    const out = execFileSync(command, args, {
      cwd,
      env,
      input: inputText,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 900_000,
    });
    return out.trim();
  } catch (err) {
    const stderr =
      err && typeof err === 'object' && 'stderr' in err && err.stderr
        ? String(err.stderr).trim()
        : String(err);
    throw new Error(`${command} ${args[0] ?? ''} failed:\n${stderr}`, { cause: err });
  }
}

export function stripRedirectCredentials(headers) {
  const clean = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    const lower = key.toLowerCase();
    if (lower !== 'authorization' && lower !== 'proxy-authorization') {
      clean[key] = value;
    }
  }
  return clean;
}

export function validateRedirectTarget(newUrl) {
  const parsed = new URL(newUrl);
  if (parsed.protocol !== 'https:') {
    throw new Error('Registry redirect requires HTTPS');
  }
  return parsed;
}

export async function fetchWithSafeRedirects(url, init = {}, fetchImpl = globalThis.fetch) {
  let currentUrl = url;
  let method = init.method ?? 'GET';
  let headers = { ...init.headers };
  let body = init.body;

  for (let hop = 0; hop <= 5; hop += 1) {
    const response = await fetchImpl(currentUrl, {
      method,
      headers,
      body,
      redirect: 'manual',
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new HttpError(response.status, '', `Redirect ${response.status} missing Location`);
      }
      const nextUrl = new URL(location, currentUrl);
      validateRedirectTarget(nextUrl.toString());
      headers = stripRedirectCredentials(headers);
      if (response.status === 301 || response.status === 302 || response.status === 303) {
        method = 'GET';
        body = undefined;
      }
      currentUrl = nextUrl.toString();
      continue;
    }

    const raw = Buffer.from(await response.arrayBuffer());
    if (!response.ok) {
      throw new HttpError(response.status, raw.toString('utf8'));
    }
    const lowerHeaders = {};
    response.headers.forEach((value, key) => {
      lowerHeaders[key.toLowerCase()] = value;
    });
    return { raw, headers: lowerHeaders };
  }

  throw new Error('Registry exceeded maximum redirect hops');
}

export class Registry {
  constructor(repository, token, fetchImpl = globalThis.fetch) {
    this.repository = repository;
    this.headers = { Authorization: `Bearer ${token}` };
    this.fetchImpl = fetchImpl;
  }

  static async connect(repository, options = {}) {
    const { env = process.env, fetchImpl = globalThis.fetch } = options;
    const query = new URLSearchParams({
      service: 'ghcr.io',
      scope: `repository:${repository}:pull,push`,
    });
    const credentials = `${env.GITHUB_ACTOR}:${env.GHCR_TOKEN}`;
    const basic = Buffer.from(credentials, 'utf8').toString('base64');
    const { raw } = await fetchWithSafeRedirects(
      `https://ghcr.io/token?${query.toString()}`,
      { headers: { Authorization: `Basic ${basic}` } },
      fetchImpl
    );
    const parsed = JSON.parse(raw.toString('utf8'));
    if (typeof parsed.token !== 'string' || parsed.token === '') {
      throw new Error('Registry did not return an authentication token');
    }
    return new Registry(repository, parsed.token, fetchImpl);
  }

  async request(path, options = {}) {
    const { data = undefined, mediaType = undefined } = options;
    const url = new URL(path, 'https://ghcr.io');
    if (url.protocol !== 'https:' || url.host !== 'ghcr.io') {
      throw new Error('Registry pagination attempted to leave ghcr.io');
    }
    if (
      url.pathname !== `/v2/${this.repository}/tags/list` &&
      !url.pathname.startsWith(`/v2/${this.repository}/manifests/`) &&
      !url.pathname.startsWith(`/v2/${this.repository}/blobs/`)
    ) {
      throw new Error('Unexpected registry path');
    }
    // GHCR reports MANIFEST_UNKNOWN when an existing index is not accepted.
    // Request indexes too, then refuse them explicitly in manifest().
    const headers = {
      ...this.headers,
      Accept: [...MEDIA_TYPES, ...INDEX_MEDIA_TYPES].join(', '),
    };
    if (mediaType) {
      headers['Content-Type'] = mediaType;
    }
    return fetchWithSafeRedirects(
      url.toString(),
      {
        method: data !== undefined ? 'PUT' : 'GET',
        headers,
        body: data,
      },
      this.fetchImpl
    );
  }

  async manifest(tag) {
    let raw;
    let headers;
    try {
      ({ raw, headers } = await this.request(`/v2/${this.repository}/manifests/${tag}`));
    } catch (err) {
      if (!(err instanceof HttpError) || err.status !== 404) {
        throw err;
      }
      let body;
      try {
        body = JSON.parse(err.body);
      } catch {
        throw err;
      }
      const codes = new Set((body.errors ?? []).map((entry) => entry?.code));
      if (
        codes.size === 0 ||
        [...codes].some((code) => code !== 'MANIFEST_UNKNOWN' && code !== 'NAME_UNKNOWN')
      ) {
        throw err;
      }
      return null;
    }

    const digest = `sha256:${createHash('sha256').update(raw).digest('hex')}`;
    if (headers['docker-content-digest'] !== digest) {
      throw new Error('Registry manifest digest does not match its bytes');
    }
    const doc = JSON.parse(raw.toString('utf8'));
    const mediaType = doc.mediaType;
    if (!MEDIA_TYPES.includes(mediaType)) {
      throw new Error('Expected a single-platform image manifest');
    }
    const config = doc.config?.digest;
    if (typeof config !== 'string' || !DIGEST_RE.test(config)) {
      throw new Error('Invalid image configuration digest');
    }
    return { raw, digest, config, mediaType };
  }

  async labels(manifest) {
    const { raw } = await this.request(`/v2/${this.repository}/blobs/${manifest.config}`);
    const actualDigest = `sha256:${createHash('sha256').update(raw).digest('hex')}`;
    if (actualDigest !== manifest.config) {
      throw new Error('Image configuration digest does not match its bytes');
    }
    const config = JSON.parse(raw.toString('utf8'));
    if (
      !config ||
      typeof config !== 'object' ||
      config.os !== 'linux' ||
      config.architecture !== 'amd64'
    ) {
      throw new Error('Expected a linux/amd64 image');
    }
    const labels = config.config?.Labels;
    if (
      !labels ||
      typeof labels !== 'object' ||
      Array.isArray(labels) ||
      !Object.entries(labels).every(([k, v]) => typeof k === 'string' && typeof v === 'string')
    ) {
      throw new Error('Expected string image labels');
    }
    return labels;
  }

  async versions() {
    let path = `/v2/${this.repository}/tags/list?n=1000`;
    const seen = new Set();
    const versions = new Set();
    while (path) {
      if (seen.has(path)) {
        throw new Error('Registry pagination repeated a page');
      }
      seen.add(path);
      const { raw, headers } = await this.request(path);
      const payload = JSON.parse(raw.toString('utf8'));
      for (const tag of payload.tags ?? []) {
        if (STABLE_RE.test(tag)) {
          versions.add(tag);
        }
      }
      const link = headers.link ?? '';
      if (link) {
        const match = /^<([^>]+)>;\s*rel="next"$/.exec(link);
        if (match === null) {
          throw new Error('Unexpected registry pagination link');
        }
        path = match[1];
      } else {
        path = '';
      }
    }
    return [...versions].toSorted(compareVersions);
  }

  async promote(manifest) {
    await this.request(`/v2/${this.repository}/manifests/latest`, {
      data: manifest.raw,
      mediaType: manifest.mediaType,
    });
    const actual = await this.manifest('latest');
    if (actual === null || actual.digest !== manifest.digest) {
      throw new Error("latest did not retain the version's manifest digest");
    }
  }
}

export function repositoryName(env = process.env) {
  const repository = (env.GITHUB_REPOSITORY ?? '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9._-]*$/.test(repository)) {
    throw new Error('Invalid GitHub owner/repository');
  }
  return repository;
}

export function sourceVersion(root = ROOT) {
  const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const version = rootPkg.version;
  versionNumber(version);
  const manifest = JSON.parse(readFileSync(join(root, '.release-please-manifest.json'), 'utf8'));
  if (manifest['.'] !== version) {
    throw new Error('.release-please-manifest.json version does not match package.json');
  }
  const cliPkgPath = join(root, 'apps', 'cli', 'package.json');
  if (existsSync(cliPkgPath)) {
    const cliPkg = JSON.parse(readFileSync(cliPkgPath, 'utf8'));
    if (cliPkg.version !== version) {
      throw new Error('apps/cli/package.json version does not match package.json');
    }
  }
  return version;
}

export function releaseRevision(version, options = {}) {
  const { env = process.env, run = defaultRun } = options;
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  const release = event.release ?? {};
  const tag = `v${version}`;
  if (
    env.GITHUB_EVENT_NAME !== 'release' ||
    event.action !== 'published' ||
    release.draft !== false ||
    release.prerelease !== false ||
    release.tag_name !== tag ||
    env.GITHUB_REF !== `refs/tags/${tag}`
  ) {
    throw new Error('Publishing requires a matching published stable release');
  }
  const revision = run('git', ['rev-parse', 'HEAD']);
  if (
    revision !== env.GITHUB_SHA ||
    run('git', ['rev-parse', `refs/tags/${tag}^{commit}`]) !== revision
  ) {
    throw new Error('Release tag, event commit, and checkout disagree');
  }
  run('git', ['merge-base', '--is-ancestor', revision, 'refs/remotes/origin/main']);
  return revision;
}

export function verifyLabels(labels, repository, version, revision = null) {
  const actualRevision = labels['org.opencontainers.image.revision'] ?? '';
  if (
    labels['org.opencontainers.image.source'] !== `https://github.com/${repository}` ||
    labels['org.opencontainers.image.version'] !== version ||
    !REVISION_RE.test(actualRevision) ||
    (revision !== null && actualRevision !== revision)
  ) {
    throw new Error('Existing image source, version, or revision conflicts');
  }
}

export function parseTarEntries(buffer) {
  const entries = new Map();
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      break;
    }
    const nameRaw = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const prefixRaw = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');
    const name = prefixRaw ? `${prefixRaw}/${nameRaw}` : nameRaw;
    const sizeRaw = header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim();
    const size = sizeRaw === '' ? 0 : Number.parseInt(sizeRaw, 8);
    if (!Number.isFinite(size) || size < 0) {
      throw new Error(`Invalid tar entry size for ${name}`);
    }
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > buffer.length) {
      throw new Error(`Truncated tar entry for ${name}`);
    }
    entries.set(name, buffer.subarray(dataStart, dataEnd));
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return entries;
}

export function savedConfigDigest(image, directory, run = defaultRun) {
  const archive = join(directory, 'image.tar');
  run('docker', ['image', 'save', '--output', archive, image]);
  const entries = parseTarEntries(readFileSync(archive));
  const manifestBytes = entries.get('manifest.json');
  if (!manifestBytes) {
    throw new Error('the saved image has no manifest.json file');
  }
  const manifests = JSON.parse(manifestBytes.toString('utf8'));
  if (
    !Array.isArray(manifests) ||
    manifests.length !== 1 ||
    !manifests[0] ||
    typeof manifests[0] !== 'object' ||
    typeof manifests[0].Config !== 'string'
  ) {
    throw new Error('the saved image does not list exactly one configuration');
  }
  const configBytes = entries.get(manifests[0].Config);
  if (!configBytes) {
    throw new Error(`the saved image has no ${manifests[0].Config} file`);
  }
  return `sha256:${createHash('sha256').update(configBytes).digest('hex')}`;
}

export async function smokeTest(imageId, version, options = {}) {
  const { run = defaultRun, sleepMs = 1_000, timeoutMs = 90_000 } = options;
  if (!DIGEST_RE.test(imageId)) {
    throw new Error('Smoke tests must run an exact local image ID');
  }
  const container = run('docker', [
    'run',
    '--platform=linux/amd64',
    '--detach',
    '--pull=never',
    imageId,
  ]);
  const probe =
    "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/healthz')" +
    '.then((r) => r.json())' +
    '.then((health) => console.log(JSON.stringify({ health, uid: process.getuid() })))';
  try {
    const deadline = Date.now() + timeoutMs;
    let result;
    for (;;) {
      try {
        result = JSON.parse(run('docker', ['exec', container, 'node', '-e', probe]));
        break;
      } catch (err) {
        if (
          Date.now() >= deadline ||
          run('docker', ['inspect', '--format', '{{.State.Running}}', container]) !== 'true'
        ) {
          throw err;
        }
        await new Promise((resolveSleep) => setTimeout(resolveSleep, sleepMs));
      }
    }
    if (result.health?.status !== 'ok' || result.health?.version !== version) {
      throw new Error('Container health response does not match the release');
    }
    if (result.uid === 0) {
      throw new Error('Container runs as root');
    }
    console.log(`Smoke test passed: version ${version}, uid ${result.uid}, ${imageId}`);
  } finally {
    run('docker', ['rm', '--force', container]);
  }
}

export async function build(repository, version, revision, options = {}) {
  const { run = defaultRun, smoke = smokeTest } = options;
  const image = `ghcr.io/${repository}:${version}`;
  console.log(`Building and testing ${image}`);
  const directory = mkdtempSync(join(tmpdir(), 'ghcr-build-'));
  let configDigest;
  try {
    const metadata = join(directory, 'metadata.json');
    run('docker', [
      'buildx',
      'build',
      '--file',
      'apps/api/Dockerfile',
      '--load',
      '--platform',
      'linux/amd64',
      '--provenance=false',
      '--metadata-file',
      metadata,
      '--label',
      `org.opencontainers.image.source=https://github.com/${repository}`,
      '--label',
      `org.opencontainers.image.version=${version}`,
      '--label',
      `org.opencontainers.image.revision=${revision}`,
      '--tag',
      image,
      '.',
    ]);
    const response = JSON.parse(readFileSync(metadata, 'utf8'));
    configDigest = response['containerimage.config.digest'];
    if (configDigest === undefined || configDigest === null) {
      try {
        configDigest = savedConfigDigest(image, directory, run);
      } catch (err) {
        const keys = Object.keys(response).toSorted().join(', ');
        throw new Error(
          `Buildx metadata has no containerimage.config.digest (keys: ${keys}) and ${err instanceof Error ? err.message : String(err)}`,
          { cause: err }
        );
      }
    }
    if (typeof configDigest !== 'string' || !DIGEST_RE.test(configDigest)) {
      throw new Error('Buildx did not record a valid configuration digest');
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  const imageId = run('docker', ['image', 'inspect', '--format', '{{.Id}}', image]);
  await smoke(imageId, version, { run });
  return { imageId, configDigest };
}

export async function pullTest(repository, version, manifest, env, options = {}) {
  const { run = defaultRun, smoke = smokeTest } = options;
  const reference = `ghcr.io/${repository}@${manifest.digest}`;
  run('docker', ['pull', '--platform=linux/amd64', reference], { env });
  const imageId = run('docker', ['image', 'inspect', '--format', '{{.Id}}', reference], { env });
  await smoke(imageId, version, { run });
}

export function verifyPublic(repository, manifest, options = {}) {
  const { env = process.env, run = defaultRun } = options;
  const directory = mkdtempSync(join(tmpdir(), 'ghcr-anonymous-'));
  try {
    const anonEnv = { ...env, DOCKER_CONFIG: directory };
    try {
      run(
        'docker',
        ['pull', '--platform=linux/amd64', `ghcr.io/${repository}@${manifest.digest}`],
        {
          env: anonEnv,
        }
      );
    } catch (err) {
      throw new Error(
        'Anonymous pull failed. The image may still be private. Set the GHCR ' +
          'package visibility to Public, then rerun this release; it will reuse ' +
          `the published image. If already public, check the registry error: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err }
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export async function publish(repository, version, revision, registry, env, effects = {}) {
  const {
    buildFn = build,
    run = defaultRun,
    pullTestFn = pullTest,
    verifyPublicFn = verifyPublic,
  } = effects;
  let manifest = await registry.manifest(version);
  if (manifest !== null) {
    verifyLabels(await registry.labels(manifest), repository, version, revision);
    console.log(`Reusing ghcr.io/${repository}@${manifest.digest}`);
    await pullTestFn(repository, version, manifest, env, { run });
  } else {
    const built = await buildFn(repository, version, revision, { run });
    const image = `ghcr.io/${repository}:${version}`;
    run('docker', ['tag', built.imageId, image]);
    run('docker', ['push', '--platform=linux/amd64', image], { env });
    manifest = await registry.manifest(version);
    if (manifest === null || manifest.config !== built.configDigest) {
      throw new Error('Published image is not the exact smoke-tested image');
    }
    verifyLabels(await registry.labels(manifest), repository, version, revision);
  }
  verifyPublicFn(repository, manifest, { env, run });
  return manifest;
}

export async function promoteLatest(repository, registry, env, effects = {}) {
  const { run = defaultRun, pullTestFn = pullTest, verifyPublicFn = verifyPublic } = effects;
  const versions = await registry.versions();
  if (versions.length === 0) {
    throw new Error('No published stable container version exists');
  }
  const version = versions[versions.length - 1];
  const candidate = await registry.manifest(version);
  if (candidate === null) {
    throw new Error('Newest version disappeared during promotion');
  }
  verifyLabels(await registry.labels(candidate), repository, version);
  const current = await registry.manifest('latest');
  if (current !== null) {
    const labels = await registry.labels(current);
    const currentVersion = labels['org.opencontainers.image.version'] ?? '';
    verifyLabels(labels, repository, currentVersion);
    if (compareVersions(currentVersion, version) > 0) {
      throw new Error('Refusing to move latest backward; a version tag may have been deleted');
    }
    if (currentVersion === version && current.digest !== candidate.digest) {
      throw new Error('Existing latest conflicts with the same version tag');
    }
  }
  await pullTestFn(repository, version, candidate, env, { run });
  verifyPublicFn(repository, candidate, { env, run });
  await registry.promote(candidate);
  return candidate;
}

export async function main(options = {}) {
  const {
    argv = process.argv.slice(2),
    env = process.env,
    root = ROOT,
    run = defaultRun,
    connectRegistry = Registry.connect,
    buildFn = build,
    publishFn = publish,
    promoteLatestFn = promoteLatest,
  } = options;
  const operation = argv[0];
  if (operation !== 'check' && operation !== 'publish' && operation !== 'promote') {
    throw new Error('Usage: publish-container.mjs <check|publish|promote>');
  }
  const repository = repositoryName(env);
  if (operation === 'check') {
    await buildFn(repository, sourceVersion(root), run('git', ['rev-parse', 'HEAD']), { run });
    return;
  }
  const version = sourceVersion(root);
  const revision = releaseRevision(version, { env, run });
  const registry = await connectRegistry(repository, { env });
  const directory = mkdtempSync(join(tmpdir(), 'ghcr-publisher-'));
  let manifest;
  try {
    const dockerEnv = { ...env, DOCKER_CONFIG: directory };
    run('docker', ['login', 'ghcr.io', '--username', env.GITHUB_ACTOR, '--password-stdin'], {
      env: dockerEnv,
      inputText: env.GHCR_TOKEN,
    });
    manifest =
      operation === 'publish'
        ? await publishFn(repository, version, revision, registry, dockerEnv)
        : await promoteLatestFn(repository, registry, dockerEnv);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  const reference = `ghcr.io/${repository}@${manifest.digest}`;
  console.log(`Verified public image: ${reference}`);
  if (env.GITHUB_STEP_SUMMARY) {
    appendFileSync(env.GITHUB_STEP_SUMMARY, `Public container (${operation}): \`${reference}\`\n`);
  }
}

const isMain =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  await main();
}
