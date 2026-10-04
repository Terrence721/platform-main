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
COPY . .
RUN yarn install --immutable
# No Nx daemon or cloud cache inside a one-off build.
ENV NX_DAEMON=false NX_NO_CLOUD=true
RUN yarn nx build helpdesk-api --skip-nx-cache

# Run: only the built API and the packages it loads (webpack.config.cjs
# lists them in the generated package.json). npm, unlike Yarn, also adds
# required peers such as rxjs. Its download cache is cleared in the same
# step, or it would stay in the image (about 300 MB).
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/dist/projects/helpdesk-api ./
RUN npm install --omit=dev --no-package-lock --no-audit --no-fund \
  && npm cache clean --force \
  && rm yarn.lock
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
# exec: the API itself receives Docker's stop signal.
CMD ["sh", "-c", "node setup.js && exec node main.js"]
