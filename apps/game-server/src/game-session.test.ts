import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoomManager } from './room-manager.js';
import { startGame, handleMove, handleDisconnect, handleReconnect } from './game-session.js';
import { UltimateTTT } from '@tactictoe/game-engine';
import type { RoomState } from './types.js';
import type { MakeMovePayload } from './types.js';

// Minimal mock Server that records emissions
function createMockIo() {
  const emissions: { room: string; event: string; data: unknown }[] = [];
  const socketEmissions: { socketId: string; event: string; data: unknown }[] = [];

  const io = {
    to(room: string) {
      return {
        emit(event: string, data: unknown) {
          emissions.push({ room, event, data });
        },
      };
    },
    sockets: {
      to(socketId: string) {
        return {
          emit(event: string, data: unknown) {
            socketEmissions.push({ socketId, event, data });
          },
        };
      },
    },
  } as unknown as import('socket.io').Server;

  return { io, emissions, socketEmissions };
}

function createMockSocket(id: string) {
  const emissions: { event: string; data: unknown }[] = [];
  const socket = {
    id,
    emit(event: string, data: unknown) {
      emissions.push({ event, data });
    },
  } as unknown as import('socket.io').Socket;
  return { socket, emissions };
}

describe('startGame', () => {
  it('emits game:started to room with initial state and players', () => {
    const rm = createRoomManager();
    const { io, emissions } = createMockIo();
    const code = rm.generateCode();
    const room = rm.createRoom(code, {
      socketId: 'socket-x',
      guestId: 'guest-x',
      displayName: 'PlayerX',
      playerIndex: 0,
    }, 'ultimate_ttt');
    rm.addPlayer(room, {
      socketId: 'socket-o',
      guestId: 'guest-o',
      displayName: 'PlayerO',
      playerIndex: 1,
    });

    startGame(io, room);

    const started = emissions.find((e) => e.event === 'game:started');
    expect(started).toBeDefined();
    expect(room.status).toBe('active');
    expect(room.gameState).not.toBeNull();
    const payload = started!.data as { players: { displayName: string }[] };
    expect(payload.players).toHaveLength(2);
    expect(payload.players[0]!.displayName).toBe('PlayerX');
  });
});

describe('handleMove', () => {
  function makeGameRoom(rm: ReturnType<typeof createRoomManager>) {
    const code = rm.generateCode();
    const room = rm.createRoom(code, {
      socketId: 'socket-x',
      guestId: 'guest-x',
      displayName: 'PlayerX',
      playerIndex: 0,
    }, 'ultimate_ttt');
    rm.addPlayer(room, {
      socketId: 'socket-o',
      guestId: 'guest-o',
      displayName: 'PlayerO',
      playerIndex: 1,
    });
    const { io, emissions } = createMockIo();
    startGame(io, room);
    // Clear emissions after startGame so tests only see move emissions
    emissions.length = 0;
    return { room, code };
  }

  it('valid move emits game:state with updated state and lastMove', () => {
    const rm = createRoomManager();
    const { room, code } = makeGameRoom(rm);
    const { io, emissions } = createMockIo();
    const { socket } = createMockSocket('socket-x');

    const payload: MakeMovePayload = { roomCode: code, boardIndex: 4, cellIndex: 4 };
    handleMove(io, socket, payload, rm);

    const update = emissions.find((e) => e.event === 'game:state');
    expect(update).toBeDefined();
    const data = update!.data as { lastMove: { boardIndex: number; cellIndex: number } };
    expect(data.lastMove.boardIndex).toBe(4);
    expect(data.lastMove.cellIndex).toBe(4);
  });

  it('out-of-turn move emits error to socket', () => {
    const rm = createRoomManager();
    const { room, code } = makeGameRoom(rm);
    const { io } = createMockIo();
    // O tries to go first (it's X's turn)
    const { socket, emissions: socketEmissions } = createMockSocket('socket-o');

    const payload: MakeMovePayload = { roomCode: code, boardIndex: 0, cellIndex: 0 };
    handleMove(io, socket, payload, rm);

    expect(socketEmissions.some((e) => e.event === 'error')).toBe(true);
  });

  it('engine-rejected (illegal) move emits error to socket', () => {
    const rm = createRoomManager();
    const { room, code } = makeGameRoom(rm);
    const { io } = createMockIo();
    const { socket, emissions: socketEmissions } = createMockSocket('socket-x');

    // First move: board 4, cell 4 — sends opponent to board 4
    handleMove(io, socket, { roomCode: code, boardIndex: 4, cellIndex: 4 }, rm);

    // Now it's O's turn but X tries again (wrong turn)
    handleMove(io, socket, { roomCode: code, boardIndex: 4, cellIndex: 0 }, rm);

    expect(socketEmissions.some((e) => e.event === 'error')).toBe(true);
  });

  it('terminal move emits game:over with correct winner', async () => {
    const rm = createRoomManager();
    const code = rm.generateCode();
    const { io, emissions } = createMockIo();

    // Inject a near-terminal state: X needs one more win to win the meta-board
    // boardResults: X has won boards 0,1 — needs board 2. Board 2 has X at cells 0,1 (needs 2).
    // nextBoardConstraint: 2 (O just played cell 2 somewhere)
    // Current player: X
    const nearTerminal = {
      variantId: 'ultimate_ttt',
      currentPlayer: 'X' as const,
      moveCount: 20,
      boards: [
        ['X','X','X','O','O',null,null,null,null], // board 0: won by X (top row)
        ['X','X','X','O','O',null,null,null,null], // board 1: won by X (top row)
        ['X','X',null,null,null,null,null,null,null], // board 2: X at 0,1 — needs cell 2
        [null,null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null,null],
      ],
      boardResults: ['X','X',null,null,null,null,null,null,null] as ['X','X',null,null,null,null,null,null,null],
      nextBoardConstraint: 2,
      terminal: null,
    };

    const engine = new UltimateTTT();
    const state = engine.deserialize(JSON.stringify(nearTerminal));

    const room = rm.createRoom(code, {
      socketId: 'socket-x',
      guestId: 'guest-x',
      displayName: 'PlayerX',
      playerIndex: 0,
    }, 'ultimate_ttt');
    rm.addPlayer(room, {
      socketId: 'socket-o',
      guestId: 'guest-o',
      displayName: 'PlayerO',
      playerIndex: 1,
    });
    room.status = 'active';
    room.gameState = state as import('@tactictoe/game-engine').UltimateTTTState;

    const { socket } = createMockSocket('socket-x');

    // X plays board 2, cell 2 — wins board 2, winning top row of meta (boards 0,1,2)
    handleMove(io, socket, { roomCode: code, boardIndex: 2, cellIndex: 2 }, rm);

    const gameOver = emissions.find((e) => e.event === 'game:over');
    expect(gameOver).toBeDefined();
    const data = gameOver!.data as { winner: string; reason: string };
    expect(data.winner).toBe('X');
    expect(data.reason).toBe('win');
    expect(room.status).toBe('finished');
  });

  it('accumulates moveHistory during a game', () => {
    const rm = createRoomManager();
    const { room, code } = makeGameRoom(rm);
    const { io } = createMockIo();
    const { socket: socketX } = createMockSocket('socket-x');
    const { socket: socketO } = createMockSocket('socket-o');

    expect(room.moveHistory).toHaveLength(0);

    handleMove(io, socketX, { roomCode: code, boardIndex: 4, cellIndex: 4 }, rm);
    expect(room.moveHistory).toHaveLength(1);
    expect(room.moveHistory[0]).toMatchObject({ boardIndex: 4, cellIndex: 4, player: 'X' });

    // O must play in board 4 (the cell X just played determines next board)
    handleMove(io, socketO, { roomCode: code, boardIndex: 4, cellIndex: 0 }, rm);
    expect(room.moveHistory).toHaveLength(2);
    expect(room.moveHistory[1]).toMatchObject({ boardIndex: 4, cellIndex: 0, player: 'O' });
  });
});

describe('handleDisconnect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeActiveRoom(rm: ReturnType<typeof createRoomManager>): RoomState {
    const code = rm.generateCode();
    const room = rm.createRoom(code, {
      socketId: 'socket-x',
      guestId: 'guest-x',
      displayName: 'PlayerX',
      playerIndex: 0,
    }, 'ultimate_ttt');
    rm.addPlayer(room, {
      socketId: 'socket-o',
      guestId: 'guest-o',
      displayName: 'PlayerO',
      playerIndex: 1,
    });
    room.status = 'active';
    // Set a minimal game state (non-null so forfeit payload works)
    room.gameState = {
      variantId: 'ultimate_ttt',
      currentPlayer: 'X',
      moveCount: 5,
      boards: Array(9).fill(Array(9).fill(null)),
      boardResults: Array(9).fill(null),
      nextBoardConstraint: null,
      terminal: null,
    } as unknown as import('@tactictoe/game-engine').UltimateTTTState;
    return room;
  }

  it('emits player:disconnected immediately on disconnect', () => {
    const rm = createRoomManager();
    const room = makeActiveRoom(rm);
    const { io, emissions } = createMockIo();

    rm.removeSocket('socket-x');
    handleDisconnect(io, room.roomCode, 'guest-x', rm);

    expect(emissions.some((e) => e.event === 'player:disconnected')).toBe(true);
  });

  it('emits game:over with reason forfeit after 60s grace period expires', () => {
    const rm = createRoomManager();
    const room = makeActiveRoom(rm);
    const { io, emissions } = createMockIo();

    rm.removeSocket('socket-x');
    handleDisconnect(io, room.roomCode, 'guest-x', rm);

    // Before 60s: no game:over yet
    vi.advanceTimersByTime(59_000);
    expect(emissions.some((e) => e.event === 'game:over')).toBe(false);

    // After 60s: forfeit fires
    vi.advanceTimersByTime(1_001);
    const gameOver = emissions.find((e) => e.event === 'game:over');
    expect(gameOver).toBeDefined();
    expect((gameOver!.data as { reason: string }).reason).toBe('forfeit');
    expect((gameOver!.data as { winner: string }).winner).toBe('O');
    expect(room.status).toBe('finished');
  });

  it('cancels the forfeit timer when the player reconnects before 60s', () => {
    const rm = createRoomManager();
    const room = makeActiveRoom(rm);
    const { io, emissions } = createMockIo();

    rm.removeSocket('socket-x');
    handleDisconnect(io, room.roomCode, 'guest-x', rm);

    // Player reconnects at 30s
    vi.advanceTimersByTime(30_000);
    rm.reconnectPlayer(room, 'guest-x', 'new-socket-x');
    handleReconnect(io, room, 'new-socket-x');

    // Timer should be cancelled — no game:over after full 60s
    vi.advanceTimersByTime(31_000);
    expect(emissions.some((e) => e.event === 'game:over')).toBe(false);
    expect(room.status).toBe('active');
  });

  it('does not fire forfeit if game was finished before timer expires', () => {
    const rm = createRoomManager();
    const room = makeActiveRoom(rm);
    const { io, emissions } = createMockIo();

    rm.removeSocket('socket-x');
    handleDisconnect(io, room.roomCode, 'guest-x', rm);

    // Game ends by other means before timer fires
    room.status = 'finished';

    vi.advanceTimersByTime(61_000);
    const forfeitEvents = emissions.filter(
      (e) => e.event === 'game:over' && (e.data as { reason: string }).reason === 'forfeit'
    );
    expect(forfeitEvents).toHaveLength(0);
  });
});
