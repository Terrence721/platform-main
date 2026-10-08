# The Helpdesk API as an image. Build from the repo root, which the build
# stage needs whole (Yarn workspaces, Nx, @helpdesk/contract):
#
#   docker build -f projects/helpdesk-api/Dockerfile -t helpdesk-api .
#
# The container migrates the database at DATABASE_URL, seeds it when
# HELPDESK_SEED=true and it has no users yet, then serves the API on 3000.

# Build: install the workspace and build the API, as CI does. Node matches
# .node-version.
FROM node:24-alpine AS build
WORKDIR /repo
RUN corepack enable
# The package list first, then the install, then the source: Docker reuses
# the install (the slow step) until package.json or yarn.lock changes, and
# Yarn keeps its downloads in a cache that outlives each build.
COPY package.json yarn.lock .yarnrc.yml ./
RUN --mount=type=cache,target=/root/.yarn/berry/cache,sharing=locked \
  yarn install --immutable
COPY . .
# No Nx daemon or cloud cache inside a one-off build.
ENV NX_DAEMON=false NX_NO_CLOUD=true
RUN yarn nx build helpdesk-api --skip-nx-cache

# Run: only the built API and the packages it loads (webpack.config.cjs
# lists them in the generated package.json). Yarn installs them from this
# repo's yarn.lock, so the image gets every version CI tested, not whatever
# is newest on the day of the build. The repo's lockfile, not the one Nx
# generates beside the package.json, which leaves some out (those under
# qs). Not --immutable, as Yarn drops the entries the API does not use.
# Into node_modules, as Node loads them; Yarn and its caches are removed in
# the same step, or they would stay in the image.
FROM node:24-alpine
ENV NODE_ENV=production COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
COPY --from=build /repo/dist/projects/helpdesk-api ./
COPY --from=build /repo/yarn.lock ./
RUN corepack enable \
  && printf '%s\n' 'nodeLinker: node-modules' 'enableGlobalCache: false' \
    'enableImmutableInstalls: false' 'enableTelemetry: false' > .yarnrc.yml \
  && yarn install \
  && rm -rf .yarn .yarnrc.yml yarn.lock /root/.cache /root/.yarn
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
# exec: the API itself receives Docker's stop signal.
CMD ["sh", "-c", "node setup.js && exec node main.js"]
