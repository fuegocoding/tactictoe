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
# Prisma CLI is not traced by Next.js standalone (it's a CLI tool, not imported) — copy explicitly
COPY --from=builder /repo/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /repo/node_modules/prisma ./node_modules/prisma
COPY --from=builder /repo/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000

# Run migrations then start. The standalone server.js is at the bundle root.
# prisma is in node_modules because it's a prod dep.
CMD ["sh", "-c", "node node_modules/.bin/prisma migrate deploy && node server.js"]
