import type { UltimateTTTState } from '@tactictoe/game-engine';

export type RoomStatus = 'waiting' | 'active' | 'finished';

export interface ConnectedPlayer {
  socketId: string;
  guestId: string;       // UUID: stable within a session, used for reconnection
  displayName: string;   // e.g. "Guest#4271"
  playerIndex: 0 | 1;   // 0 = X, 1 = O
}

export interface RoomState {
  roomCode: string;
  status: RoomStatus;
  players: ConnectedPlayer[];        // max 2
  spectators: string[];              // socket IDs
  gameState: UltimateTTTState | null;
  variantId: string;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
  createdAt: number;                 // Date.now()
}

// ─── Socket.io event payloads (client → server) ───────────────────────────────

export interface CreateRoomPayload {
  guestId: string;
  displayName: string;
  variantId: string;
}

export interface JoinRoomPayload {
  roomCode: string;
  guestId: string;
  displayName: string;
}

export interface MakeMovePayload {
  roomCode: string;
  boardIndex: number;
  cellIndex: number;
}

// ─── Socket.io event payloads (server → client) ───────────────────────────────

export interface RoomCreatedPayload {
  roomCode: string;
  playerIndex: 0 | 1;
}

export interface RoomJoinedPayload {
  roomCode: string;
  playerIndex: 0 | 1;
  players: { displayName: string; playerIndex: 0 | 1 }[];
}

export interface GameStartedPayload {
  gameState: UltimateTTTState;
  players: { displayName: string; playerIndex: 0 | 1 }[];
}

export interface GameStateUpdatePayload {
  gameState: UltimateTTTState;
  lastMove: { boardIndex: number; cellIndex: number };
}

export interface GameOverPayload {
  gameState: UltimateTTTState;
  winner: 'X' | 'O' | null;
  reason: 'win' | 'draw' | 'forfeit';
  winnerDisplayName: string | null;
}

export interface ErrorPayload {
  message: string;
}
