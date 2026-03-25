# TacticToe

TacticToe is a TypeScript monorepo for an online multiplayer board game platform focused on Tic-Tac-Toe and variant game modes.

## Monorepo layout

- `apps/web` – Next.js web app
- `apps/game-server` – Socket.IO real-time game server
- `packages/game-engine` – shared game rules and AI logic
- `packages/glicko2` – shared rating system package

## Prerequisites

- Node.js 20+
- Corepack enabled (`corepack enable`)

## Install

```bash
pnpm install
```

## Run in development

Start the game server:

```bash
pnpm dev:server
```

Start the web app:

```bash
pnpm --filter web dev
```

## Build

```bash
pnpm build
```

## Test

```bash
pnpm test
```

> Note: the current workspace includes `packages/glicko2` with no test files, which can cause `pnpm test` to fail until tests are added or that package test script is adjusted.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
