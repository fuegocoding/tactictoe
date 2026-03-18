import { describe, it, expect, beforeEach } from 'vitest';

// We import a factory function (not the singleton) to get a fresh instance per test.
import { createRoomManager } from './room-manager.js';
import type { ConnectedPlayer } from './types.js';

function makePlayer(overrides: Partial<ConnectedPlayer> = {}): ConnectedPlayer {
  return {
    socketId: 'socket-1',
    guestId: 'guest-001',
    displayName: 'Alice',
    playerIndex: 0,
    ...overrides,
  };
}

describe('RoomManager', () => {
  let rm: ReturnType<typeof createRoomManager>;

  beforeEach(() => {
    rm = createRoomManager();
  });

  describe('generateCode', () => {
    it('generates a 6-character code', () => {
      expect(rm.generateCode()).toHaveLength(6);
    });

    it('generates unique codes on repeated calls', () => {
      const codes = new Set(Array.from({ length: 100 }, () => rm.generateCode()));
      expect(codes.size).toBe(100);
    });

    it('code characters are from the allowed set (no 0, O, I, 1, l)', () => {
      const code = rm.generateCode();
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    });
  });

  describe('createRoom', () => {
    it('creates a room with the given code and host', () => {
      const host = makePlayer();
      const code = rm.generateCode();
      const room = rm.createRoom(code, host, 'ultimate_ttt');
      expect(room.roomCode).toBe(code);
      expect(room.players).toHaveLength(1);
      expect(room.players[0]).toBe(host);
      expect(room.status).toBe('waiting');
      expect(room.variantId).toBe('ultimate_ttt');
    });

    it('stores the room and makes it retrievable by code', () => {
      const code = rm.generateCode();
      rm.createRoom(code, makePlayer(), 'ultimate_ttt');
      expect(rm.getRoom(code)).toBeDefined();
    });

    it('increments activeCount', () => {
      expect(rm.activeCount).toBe(0);
      rm.createRoom(rm.generateCode(), makePlayer(), 'ultimate_ttt');
      expect(rm.activeCount).toBe(1);
    });
  });

  describe('getRoom', () => {
    it('returns undefined for unknown code', () => {
      expect(rm.getRoom('XXXXXX')).toBeUndefined();
    });
  });

  describe('removeSocket', () => {
    it('marks a player as disconnected and returns roomCode + wasPlayer=true', () => {
      const code = rm.generateCode();
      const host = makePlayer({ socketId: 'socket-abc' });
      rm.createRoom(code, host, 'ultimate_ttt');

      const result = rm.removeSocket('socket-abc');
      expect(result).not.toBeNull();
      expect(result?.roomCode).toBe(code);
      expect(result?.wasPlayer).toBe(true);

      // socketId should be cleared
      const room = rm.getRoom(code)!;
      expect(room.players[0]!.socketId).toBe('');
    });

    it('returns null for an unknown socketId', () => {
      expect(rm.removeSocket('no-such-socket')).toBeNull();
    });

    it('removes a spectator and returns wasPlayer=false', () => {
      const code = rm.generateCode();
      rm.createRoom(code, makePlayer(), 'ultimate_ttt');
      const room = rm.getRoom(code)!;
      rm.addSpectator(room, 'spectator-socket');

      const result = rm.removeSocket('spectator-socket');
      expect(result?.wasPlayer).toBe(false);
      expect(room.spectators).not.toContain('spectator-socket');
    });
  });

  describe('reconnectPlayer', () => {
    it('updates socketId and returns the player', () => {
      const code = rm.generateCode();
      rm.createRoom(code, makePlayer({ socketId: '', guestId: 'g-1' }), 'ultimate_ttt');
      const room = rm.getRoom(code)!;

      const player = rm.reconnectPlayer(room, 'g-1', 'new-socket-id');
      expect(player).not.toBeNull();
      expect(player!.socketId).toBe('new-socket-id');
    });

    it('returns null if guestId is not found', () => {
      const code = rm.generateCode();
      rm.createRoom(code, makePlayer(), 'ultimate_ttt');
      const room = rm.getRoom(code)!;
      expect(rm.reconnectPlayer(room, 'no-such-guest', 'sock')).toBeNull();
    });
  });

  describe('purgeExpired', () => {
    it('removes waiting rooms older than TTL and returns count', () => {
      const code = rm.generateCode();
      const room = rm.createRoom(code, makePlayer(), 'ultimate_ttt');
      // Manually backdate the room
      (room as { createdAt: number }).createdAt = Date.now() - 31 * 60 * 1000;

      const purged = rm.purgeExpired();
      expect(purged).toBe(1);
      expect(rm.getRoom(code)).toBeUndefined();
    });

    it('does not purge active rooms regardless of age', () => {
      const code = rm.generateCode();
      const room = rm.createRoom(code, makePlayer(), 'ultimate_ttt');
      room.status = 'active';
      (room as { createdAt: number }).createdAt = Date.now() - 31 * 60 * 1000;

      const purged = rm.purgeExpired();
      expect(purged).toBe(0);
      expect(rm.getRoom(code)).toBeDefined();
    });
  });
});
