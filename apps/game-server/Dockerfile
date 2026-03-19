FROM node:20-alpine AS base
RUN npm install -g pnpm

# Install deps from monorepo root (needed for workspace: protocol)
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/game-engine/package.json ./packages/game-engine/
COPY apps/game-server/package.json ./apps/game-server/
RUN pnpm install --frozen-lockfile

# Build
FROM deps AS builder
COPY packages/game-engine/ ./packages/game-engine/
COPY apps/game-server/ ./apps/game-server/
RUN pnpm --filter game-server build

# Production image — only copy compiled output + prod deps
FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/game-engine/package.json ./packages/game-engine/
COPY apps/game-server/package.json ./apps/game-server/
RUN pnpm install --frozen-lockfile --prod
# Copy compiled JS and the game-engine source (it's consumed as a workspace dep at runtime)
COPY --from=builder /app/apps/game-server/dist ./apps/game-server/dist
COPY --from=builder /app/packages/game-engine/src ./packages/game-engine/src
EXPOSE 4000
CMD ["node", "apps/game-server/dist/index.js"]
