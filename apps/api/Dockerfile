# Container image for the API (D-050). Build from the REPO ROOT, where the
# workspace and lockfile live:
#   docker build -f apps/api/Dockerfile -t ts-launch-blueprint-api .

# Build stage: install the workspace with the pinned pnpm, build the API.
FROM node:25-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370 AS build
WORKDIR /repo
# pnpm pinned to the root packageManager version (D-035); not corepack, which
# newer Node versions no longer ship.
RUN npm install -g pnpm@10.34.3
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/cli/package.json apps/cli/
COPY apps/web/package.json apps/web/
# --ignore-scripts: the build context has no .git (.dockerignore), so the root
# `prepare` script (lefthook install) would fail. No build script is needed for
# the API, and pnpm 10 already blocks the only ones in the tree.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --filter @ts-launch-blueprint/api...
COPY . .
RUN pnpm --filter @ts-launch-blueprint/api build

# Runtime stage: only the bundled server (every dependency is in
# dist/server.js), run as the non-root `node` user.
FROM node:25-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0
WORKDIR /app
COPY --from=build /repo/apps/api/dist ./dist
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/healthz').then((r) => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))"]
CMD ["node", "dist/server.js"]
