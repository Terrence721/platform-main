# The Helpdesk app as an image: the built Angular app, served by nginx,
# which also passes /api to the API container (nginx.conf). Build from the
# repo root, which the build stage needs whole (Nx, @helpdesk/contract, the
# NgRx modules):
#
#   docker build -f projects/helpdesk/Dockerfile -t helpdesk-app .
#
# Compose runs it beside the API: `docker compose --profile full up`.

# Build: install the workspace and build the app, as CI does. Node matches
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
# Only the app: it compiles the NgRx modules from their source (the paths in
# tsconfig.json), so building each module's package first (about 70 s) would
# be wasted.
RUN yarn nx build helpdesk --skip-nx-cache --excludeTaskDependencies

# Run: nginx as a non-root user, on 8080, with only the built files.
FROM nginxinc/nginx-unprivileged:alpine
COPY projects/helpdesk/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/dist/projects/helpdesk/browser /usr/share/nginx/html
EXPOSE 8080
# 127.0.0.1, not localhost: inside the container localhost is IPv6 (::1),
# and nginx.conf listens on IPv4 only.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ > /dev/null || exit 1
