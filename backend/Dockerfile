# Ticket Booking API — production image (docs/12-deployment.md).
# Multi-stage: dependencies are installed in a builder stage so the runtime
# layer only carries node_modules + application code (no npm cache, no dev
# leftovers). Runs as the non-root `node` user.

# ---- deps: install a clean, lockfile-exact node_modules --------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- runtime: minimal production image -------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app

# NODE_ENV=production is required: config/env.js refuses dev JWT secrets and
# enables secure cookies when this is set.
ENV NODE_ENV=production \
    PORT=4000

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY scripts ./scripts

# Drop root — the image ships with an unprivileged `node` user.
USER node

EXPOSE 4000

# BusyBox wget is built into alpine: no extra packages for the health probe.
# The API keeps serving /health even when MySQL is unreachable, so this probe
# only signals process liveness; DB readiness is surfaced on /health/db.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health >/dev/null 2>&1 || exit 1

CMD ["node", "src/index.js"]
