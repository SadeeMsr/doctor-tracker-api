# syntax=docker/dockerfile:1

# ─── Base: the Node version from .nvmrc, plus pnpm ───────────────────────────
# Debian slim, not Alpine: argon2 is a native module and its glibc prebuilds just work.
# Node 25+ no longer bundles Corepack, so pnpm is installed at the version package.json pins.
FROM node:26.13.0-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    HUSKY=0
RUN npm install --global pnpm@12.3.4 && npm cache clean --force
WORKDIR /app

# ─── Build: all dependencies, compile TypeScript to dist/ ────────────────────
FROM base AS build
# Manifests first, so editing source code doesn't invalidate the install layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm build

# ─── Production dependencies only (no TypeScript, ESLint, Vitest...) ─────────
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# `prepare` runs husky, a dev dependency that isn't installed here (and there are no git hooks).
RUN npm pkg delete scripts.prepare
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod

# ─── Runtime: compiled code + production node_modules, as a non-root user ────
FROM node:26.13.0-slim AS runtime
ENV NODE_ENV=production \
    PORT=4000
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 4000

# /health returns 503 when MongoDB is unreachable, so the container is marked unhealthy.
# Uses Node's built-in fetch: the slim image has no curl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/api/v1/health`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

# Node is PID 1 directly (not `pnpm start`), so SIGTERM from `docker stop` reaches the
# graceful-shutdown handler in server.ts: drain connections, close MongoDB, exit 0.
CMD ["node", "dist/server.js"]
