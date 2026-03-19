import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoomManager } from './room-manager.js';
import { handleDisconnect, handleReconnect } from './game-session.js';
import type { RoomState } from './types.js';

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
