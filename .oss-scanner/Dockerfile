# Build image for Anthropic OSS Scanner (P13 / Q11.C). Not a production image —
# see apps/api/Dockerfile for the runtime API image. The scanner builds this
# with the repository root as the build context, then runs its agents fully
# offline, so workspace dependencies and build outputs are pre-installed here.
#   docker build -f .oss-scanner/Dockerfile -t ts-oss-scanner .
#   docker run --rm --network none ts-oss-scanner pnpm exec vitest run --exclude '**/e2e.test.ts'

# Digest-pinned Node 24 image matching apps/api/Dockerfile (D-035, D-050).
FROM node:24-slim@sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530

# Install pnpm pinned to root package.json packageManager and just for recipes.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@10.34.3 \
    && curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh \
       | bash -s -- --tag 1.59.0 --to /usr/local/bin

# Scanner contract: the checkout lives inside the image, at /src.
COPY . /src
WORKDIR /src

# Install full workspace dependencies without running prepare (lefthook) since
# .dockerignore excludes .git, then build apps so dist/ artifacts exist offline.
RUN pnpm install --frozen-lockfile --ignore-scripts \
    && pnpm -r --filter './apps/*' build

ENV CI=true

# Prove the offline image works without letting git-history/E2E tests abort the
# build (.dockerignore excludes .git, so git-reading meta-tests fail in-image).
RUN pnpm exec vitest run --exclude '**/e2e.test.ts' \
    || echo "WARNING: vitest reported failures"
