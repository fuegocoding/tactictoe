import type { GameState } from '@tactictoe/game-engine';

export type RoomStatus = 'waiting' | 'active' | 'finished';

export interface MoveRecord {
  boardIndex: number;
  cellIndex: number;
  player: 'X' | 'O';
}

export interface ConnectedPlayer {
  socketId: string;
  guestId: string;       // UUID: stable within a session, used for reconnection
  userId?: string;       // Set if authenticated
  displayName: string;   // e.g. "Guest#4271"
  playerIndex: 0 | 1;   // 0 = X, 1 = O
}

export interface RoomState {
  roomCode: string;
  status: RoomStatus;
  players: ConnectedPlayer[];        // max 2
  spectators: string[];              // socket IDs
  gameState: GameState | null;
  variantId: string;
  rated: boolean;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
  createdAt: number;                 // Date.now()
  moveHistory: MoveRecord[];         // accumulates during the game
  drawOfferPending: { fromGuestId: string } | null;  // tracks pending draw offers
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
  symbol?: string | number;
  numberPlaced?: number;
  // garrison
  garrisonType?: 'place' | 'move';
  garrisonPieceId?: string;
  garrisonFrom?: number;
  garrisonTo?: number;
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
  gameState: GameState;
  players: { displayName: string; playerIndex: 0 | 1 }[];
}

export interface GameStateUpdatePayload {
  gameState: GameState;
  lastMove: { boardIndex: number; cellIndex: number };
}

export interface GameOverPayload {
  gameState: GameState;
  winner: 'X' | 'O' | null;
  reason: 'win' | 'draw' | 'forfeit';
  winnerDisplayName: string | null;
}

export interface ErrorPayload {
  message: string;
}

export interface JoinQueuePayload {
  variantId: string;
  guestId: string;
  displayName: string;
}

export interface QueueMatchedPayload {
  roomCode: string;
  playerIndex: number;
  rated?: boolean;
}

export interface QueueStatusPayload {
  position: number;   // 1-based position in queue
  variantId: string;
  rated?: boolean;
}

export interface JoinRatedQueuePayload {
  variantId: string;
  guestId: string;
  userId: string;
  displayName: string;
}

// ─── Chat types ────────────────────────────────────────────────────────────────

export interface ChatMessagePayload {
  roomCode: string;
  message: string;
}

export interface ChatMessageBroadcast {
  guestId: string;
  displayName: string;
  message: string;
  timestamp: number;
}

// ─── Draw offer types ──────────────────────────────────────────────────────────

export interface DrawOfferPayload {
  roomCode: string;
}

export interface DrawOfferBroadcast {
  fromGuestId: string;
  fromDisplayName: string;
}

export interface DrawResponsePayload {
  roomCode: string;
  accepted: boolean;
}

// ─── Forfeit types ─────────────────────────────────────────────────────────────

export interface ForfeitPayload {
  roomCode: string;
}
