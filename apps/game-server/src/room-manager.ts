import { randomInt } from 'node:crypto';
import type { RoomState, ConnectedPlayer } from './types.js';

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/I/1/l
const MAX_ROOMS = 10_000;
const ROOM_IDLE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * In-memory room store.
 * Use `createRoomManager()` in tests (fresh instance per test).
 * Use the `roomManager` singleton in the game server.
 */
class RoomManager {
  private rooms = new Map<string, RoomState>();

  generateCode(): string {
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += ROOM_CODE_CHARS[randomInt(ROOM_CODE_CHARS.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('Failed to generate unique room code after 50 attempts');
  }

  createRoom(code: string, host: ConnectedPlayer, variantId: string, rated: boolean = false): RoomState {
    if (this.rooms.size >= MAX_ROOMS) {
      throw new Error('Room capacity reached');
    }
    const room: RoomState = {
      roomCode: code,
      status: 'waiting',
      players: [host],
      spectators: [],
      gameState: null,
      variantId,
      rated,
      disconnectTimer: null,
      createdAt: Date.now(),
      moveHistory: [],
    };
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): RoomState | undefined {
    return this.rooms.get(code);
  }

  addPlayer(room: RoomState, player: ConnectedPlayer): void {
    if (room.players.length >= 2) {
      throw new Error('Room is full');
    }
    room.players.push(player);
  }

  addSpectator(room: RoomState, socketId: string): void {
    room.spectators.push(socketId);
  }

  removeSocket(socketId: string): { roomCode: string; wasPlayer: boolean } | null {
    for (const [code, room] of this.rooms) {
      const playerIdx = room.players.findIndex((p) => p.socketId === socketId);
      if (playerIdx !== -1) {
        room.players[playerIdx]!.socketId = ''; // mark as disconnected
        return { roomCode: code, wasPlayer: true };
      }
      const spectatorIdx = room.spectators.indexOf(socketId);
      if (spectatorIdx !== -1) {
        room.spectators.splice(spectatorIdx, 1);
        return { roomCode: code, wasPlayer: false };
      }
    }
    return null;
  }

  reconnectPlayer(room: RoomState, guestId: string, newSocketId: string): ConnectedPlayer | null {
    const player = room.players.find((p) => p.guestId === guestId);
    if (!player) return null;
    player.socketId = newSocketId;
    return player;
  }

  deleteRoom(code: string): void {
    const room = this.rooms.get(code);
    if (room?.disconnectTimer) clearTimeout(room.disconnectTimer);
    this.rooms.delete(code);
  }

  /** Purge rooms idle for longer than ROOM_IDLE_TTL_MS. Call on an interval. */
  purgeExpired(): number {
    const now = Date.now();
    let count = 0;
    for (const [code, room] of this.rooms) {
      if (room.status !== 'active' && now - room.createdAt > ROOM_IDLE_TTL_MS) {
        this.deleteRoom(code);
        count++;
      }
    }
    return count;
  }

  get activeCount(): number {
    return this.rooms.size;
  }
}

export const roomManager = new RoomManager();

/** Factory for tests — returns a fresh, isolated RoomManager instance */
export function createRoomManager(): RoomManager {
  return new RoomManager();
}
