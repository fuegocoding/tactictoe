FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.4

# ── Install deps (whole monorepo — needed for workspace: protocol) ─────────────
FROM base AS deps
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/game-engine/package.json ./packages/game-engine/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

# ── Build Next.js ──────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /repo
COPY packages/game-engine/ ./packages/game-engine/
COPY apps/web/ ./apps/web/
WORKDIR /repo/apps/web
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
COPY --from=builder /repo/apps/web/.next/standalone ./
# These must be copied separately (standalone doesn't include them)
COPY --from=builder /repo/apps/web/.next/static ./.next/static
COPY --from=builder /repo/apps/web/public ./public
# Prisma migrations folder
COPY --from=builder /repo/apps/web/prisma ./prisma
# Install prisma CLI — pnpm uses symlinks so COPY from builder doesn't work
RUN npm install -g prisma@5

EXPOSE 3000

CMD ["sh", "-c", "prisma migrate deploy && node server.js"]
