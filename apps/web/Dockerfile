FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.4

# ── Install deps (whole monorepo — needed for workspace: protocol) ─────────────
FROM base AS deps
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/game-engine/package.json ./packages/game-engine/
COPY packages/glicko2/package.json ./packages/glicko2/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

# ── Build Next.js ──────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /repo
COPY packages/game-engine/ ./packages/game-engine/
COPY packages/glicko2/ ./packages/glicko2/
COPY apps/web/ ./apps/web/
WORKDIR /repo/apps/web

# Declare build-time args for NEXT_PUBLIC_ vars so Next.js bakes them in
ARG NEXT_PUBLIC_GAME_SERVER_URL
ENV NEXT_PUBLIC_GAME_SERVER_URL=$NEXT_PUBLIC_GAME_SERVER_URL

# Generate Prisma client (placeholder URL — no real DB needed at build time)
RUN DATABASE_URL="postgresql://x:x@localhost/x" pnpm db:generate
# Remove next.config.ts if present — Next.js 14 doesn't support .ts config files
RUN rm -f next.config.ts
RUN pnpm build

# ── Production image ───────────────────────────────────────────────────────────
# Next.js standalone bundles everything the server needs into .next/standalone/
FROM node:20-alpine AS runner
WORKDIR /app

# Install OpenSSL so Prisma can detect the version and use the correct engine binaries
RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone bundle (self-contained — includes its own node_modules)
# In a pnpm monorepo, standalone mirrors the repo structure:
# server.js lands at apps/web/server.js inside the bundle
COPY --from=builder /repo/apps/web/.next/standalone ./
# Static/public must match where server.js expects them (apps/web/.next/static, apps/web/public)
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/apps/web/public ./apps/web/public
# Prisma migrations folder (prisma migrate deploy runs from /app)
COPY --from=builder /repo/apps/web/prisma ./prisma
# Install prisma CLI — pnpm uses symlinks so COPY from builder doesn't work
RUN npm install -g prisma@5

EXPOSE 3000

CMD ["sh", "-c", "prisma db push --skip-generate && node apps/web/server.js"]
