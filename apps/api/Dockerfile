# Container image for the API (D-050). Build from the REPO ROOT, where the
# workspace and lockfile live:
#   docker build -f apps/api/Dockerfile -t ts-launch-blueprint-api .

# Build stage: install the workspace with the pinned pnpm, build the API.
FROM node:24-slim AS build
WORKDIR /repo
# pnpm pinned to the root packageManager version (D-035); not corepack, which
# newer Node versions no longer ship.
RUN npm install -g pnpm@10.34.3
COPY . .
# --ignore-scripts: the build context has no .git (.dockerignore), so the root
# `prepare` script (lefthook install) would fail. No build script is needed for
# the API, and pnpm 10 already blocks the only ones in the tree.
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @ts-launch-blueprint/api... \
 && pnpm --filter @ts-launch-blueprint/api build

# Runtime stage: only the bundled server (every dependency is in
# dist/server.js), run as the non-root `node` user.
FROM node:24-slim
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=build /repo/apps/api/dist ./dist
USER node
EXPOSE 8080
CMD ["node", "dist/server.js"]
