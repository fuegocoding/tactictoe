FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.4

# Install deps from monorepo root (needed for workspace: protocol)
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/game-engine/package.json ./packages/game-engine/
COPY apps/game-server/package.json ./apps/game-server/
RUN pnpm install --frozen-lockfile

# Build — esbuild bundles game-engine inline, socket.io stays external
FROM deps AS builder
COPY packages/game-engine/ ./packages/game-engine/
COPY apps/game-server/ ./apps/game-server/
RUN pnpm --filter game-server build

# Production image — socket.io only, game-engine is bundled into dist/index.js
FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm@9.15.4
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/game-engine/package.json ./packages/game-engine/
COPY apps/game-server/package.json ./apps/game-server/
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/apps/game-server/dist ./apps/game-server/dist
EXPOSE 4000
CMD ["node", "apps/game-server/dist/index.js"]
