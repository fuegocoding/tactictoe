import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRoomManager } from './room-manager.js';
import { startGame, handleMove, handleDisconnect } from './game-session.js';
import type { CreateRoomPayload, JoinRoomPayload, MakeMovePayload } from './types.js';
import type { UltimateTTTState } from '@tactictoe/game-engine';

// ─── Test server factory ──────────────────────────────────────────────────────

let io: Server;
let port: number;
// Shared room manager for the test server — allows state injection between tests
const testRm = createRoomManager();

async function createTestServer(): Promise<number> {
  const httpServer = createServer();
  io = new Server(httpServer, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    socket.on('room:create', (payload: CreateRoomPayload) => {
      const code = testRm.generateCode();
      const room = testRm.createRoom(code, {
        socketId: socket.id,
        guestId: payload.guestId,
        displayName: payload.displayName,
        playerIndex: 0,
      }, payload.variantId);
      socket.join(code);
      socket.emit('room:created', { roomCode: code, playerIndex: 0 });
    });

    socket.on('room:join', (payload: JoinRoomPayload) => {
      const room = testRm.getRoom(payload.roomCode);
      if (!room) { socket.emit('error', { message: 'Not found' }); return; }
      if (room.players.length >= 2) { socket.emit('error', { message: 'Full' }); return; }
      testRm.addPlayer(room, { socketId: socket.id, guestId: payload.guestId, displayName: payload.displayName, playerIndex: 1 });
      socket.join(payload.roomCode);
      socket.emit('room:joined', { roomCode: payload.roomCode, playerIndex: 1, players: room.players });
      if (room.players.length === 2) startGame(io, room);
    });

    socket.on('game:move', (payload: MakeMovePayload) => {
      handleMove(io, socket, payload, testRm);
    });

    socket.on('disconnect', () => {
      const result = testRm.removeSocket(socket.id);
      if (result?.wasPlayer) {
        const room = testRm.getRoom(result.roomCode);
        const p = room?.players.find((p) => p.socketId === '');
        if (room && p) handleDisconnect(io, result.roomCode, p.guestId, testRm);
      }
    });
  });

  return new Promise((resolve) => {
    httpServer.listen(0, () => {
      resolve((httpServer.address() as { port: number }).port);
    });
  });
}

function createClient(p: number): ClientSocket {
  return ioc(`http://localhost:${p}`, { autoConnect: false });
}

function waitFor<T>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), 5000);
    socket.once(event, (data: T) => { clearTimeout(timeout); resolve(data); });
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('game server integration', () => {
  beforeAll(async () => {
    port = await createTestServer();
  });

  afterAll(() => {
    io.close();
  });

  it('two clients create a room, join, and start a game', async () => {
    const c1 = createClient(port);
    const c2 = createClient(port);
    c1.connect();
    c2.connect();

    // Client 1 creates a room
    const roomCreated = waitFor<{ roomCode: string }>(c1, 'room:created');
    c1.emit('room:create', { guestId: 'guest-001', displayName: 'Alice', variantId: 'ultimate_ttt' } satisfies CreateRoomPayload);
    const { roomCode } = await roomCreated;
    expect(roomCode).toHaveLength(6);

    // Client 2 joins — both receive game:started
    const started1 = waitFor<{ gameState: UltimateTTTState }>(c1, 'game:started');
    const started2 = waitFor<{ gameState: UltimateTTTState }>(c2, 'game:started');
    c2.emit('room:join', { roomCode, guestId: 'guest-002', displayName: 'Bob' } satisfies JoinRoomPayload);
    const [s1] = await Promise.all([started1, started2]);
    expect(s1.gameState.currentPlayer).toBe('X');
    expect(s1.gameState.moveCount).toBe(0);

    // X makes one move — both receive game:state
    const state1 = waitFor<{ lastMove: { boardIndex: number; cellIndex: number } }>(c1, 'game:state');
    const state2 = waitFor<{ lastMove: { boardIndex: number; cellIndex: number } }>(c2, 'game:state');
    c1.emit('game:move', { roomCode, boardIndex: 4, cellIndex: 4 } satisfies MakeMovePayload);
    const [ms1] = await Promise.all([state1, state2]);
    expect(ms1.lastMove).toEqual({ boardIndex: 4, cellIndex: 4 });

    c1.disconnect();
    c2.disconnect();
  });

  it('two clients play a complete game to a win using state injection', async () => {
    const c1 = createClient(port);
    const c2 = createClient(port);
    c1.connect();
    c2.connect();

    const { roomCode } = await new Promise<{ roomCode: string }>((resolve) => {
      c1.once('room:created', resolve);
      c1.emit('room:create', { guestId: 'g-win-1', displayName: 'Alice', variantId: 'ultimate_ttt' });
    });

    await Promise.all([waitFor(c1, 'game:started'), waitFor(c2, 'game:started'),
      new Promise<void>((resolve) => { c2.emit('room:join', { roomCode, guestId: 'g-win-2', displayName: 'Bob' }); resolve(); })
    ]);

    // Inject near-terminal state: X has won boards 0 and 1, needs board 2.
    // Board 2: X at cells 0,1 — needs cell 2 for top-row win.
    const room = testRm.getRoom(roomCode)!;
    const nearTerminalState: UltimateTTTState = {
      variantId: 'ultimate_ttt',
      currentPlayer: 'X',
      moveCount: 30,
      boards: [
        ['X', 'X', 'X', 'O', 'O', null, null, null, null],
        ['X', 'X', 'X', 'O', 'O', null, null, null, null],
        ['X', 'X', null, 'O', 'O', null, null, null, null],
        ['O', null, null, null, 'X', null, null, null, null],
        ['O', null, null, null, 'X', null, null, null, null],
        ['O', null, null, null, 'X', null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
      ] as UltimateTTTState['boards'],
      boardResults: ['X', 'X', null, null, null, null, null, null, null],
      nextBoardConstraint: 2,
      terminal: null,
    };
    room.gameState = nearTerminalState;

    const gameOver1 = waitFor<{ winner: string | null; reason: string; winnerDisplayName: string }>(c1, 'game:over');
    const gameOver2 = waitFor<{ winner: string | null; reason: string }>(c2, 'game:over');

    // X plays board 2, cell 2 — wins board 2, completing meta top row → game over
    c1.emit('game:move', { roomCode, boardIndex: 2, cellIndex: 2 } satisfies MakeMovePayload);

    const [result] = await Promise.all([gameOver1, gameOver2]);
    expect(result.winner).toBe('X');
    expect(result.reason).toBe('win');
    expect(result.winnerDisplayName).toBe('Alice');
    expect(testRm.getRoom(roomCode)!.status).toBe('finished');

    c1.disconnect();
    c2.disconnect();
  });

  it('rejects an illegal move', async () => {
    const c1 = createClient(port);
    const c2 = createClient(port);
    c1.connect();
    c2.connect();

    const { roomCode } = await new Promise<{ roomCode: string }>((resolve) => {
      c1.emit('room:create', { guestId: 'g-a', displayName: 'Alice', variantId: 'ultimate_ttt' });
      c1.once('room:created', resolve);
    });

    await Promise.all([
      waitFor(c1, 'game:started'),
      waitFor(c2, 'game:started'),
      new Promise<void>((resolve) => { c2.emit('room:join', { roomCode, guestId: 'g-b', displayName: 'Bob' }); resolve(); }),
    ]);

    // X plays board 0 cell 0 → O must play board 0
    c1.emit('game:move', { roomCode, boardIndex: 0, cellIndex: 0 });
    await waitFor(c2, 'game:state');

    // O tries to play in board 3 (wrong board — must play board 0) → error
    const errorPromise = waitFor<{ message: string }>(c2, 'error');
    c2.emit('game:move', { roomCode, boardIndex: 3, cellIndex: 0 });
    const err = await errorPromise;
    expect(err.message).toMatch(/wrong board/i);

    c1.disconnect();
    c2.disconnect();
  });
});
