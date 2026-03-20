import type { Server, Socket } from 'socket.io';
import { UltimateTTT, StandardTTT, type GameRules, type GameState } from '@tactictoe/game-engine';
import { roomManager as defaultRoomManager, createRoomManager } from './room-manager.js';

// Allow injecting a room manager for tests
type RoomManagerInstance = ReturnType<typeof createRoomManager>;
import type {
  RoomState,
  MakeMovePayload,
  GameStartedPayload,
  GameStateUpdatePayload,
  GameOverPayload,
  MoveRecord,
} from './types.js';

const DISCONNECT_GRACE_MS = 60_000; // 60 seconds

const WEB_SERVER_URL = process.env['WEB_SERVER_URL'];
const GAME_SERVER_SECRET = process.env['GAME_SERVER_SECRET'];

async function reportResult(room: RoomState, winner: 'X' | 'O' | null, reason: string) {
  if (!room.rated || !WEB_SERVER_URL) return;
  const [p1, p2] = room.players;
  if (!p1 || !p2) return;

  try {
    await fetch(`${WEB_SERVER_URL}/api/ratings/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-game-server-secret': GAME_SERVER_SECRET ?? '',
      },
      body: JSON.stringify({
        variantId: room.variantId,
        player1: { userId: p1.userId, guestId: p1.guestId, displayName: p1.displayName, playerSymbol: p1.playerIndex === 0 ? 'X' : 'O' },
        player2: { userId: p2.userId, guestId: p2.guestId, displayName: p2.displayName, playerSymbol: p2.playerIndex === 0 ? 'X' : 'O' },
        winner,
        reason,
        rated: room.rated,
        moveHistory: room.moveHistory,
      }),
    });
  } catch (err) {
    console.error('Failed to report game result:', err);
    // Non-fatal — game continues even if rating update fails
  }
}

const engines: Record<string, GameRules> = {
  ultimate_ttt: new UltimateTTT(),
  standard_3x3: new StandardTTT(),
};

function getEngine(variantId: string): GameRules {
  const engine = engines[variantId];
  if (!engine) throw new Error(`Unknown variant: ${variantId}`);
  return engine;
}

/** Called when two players are in the room and the game should begin. */
export function startGame(io: Server, room: RoomState): void {
  const engine = getEngine(room.variantId);
  room.gameState = engine.initialize({ variantId: room.variantId });
  room.status = 'active';

  const payload: GameStartedPayload = {
    gameState: room.gameState,
    players: room.players.map((p) => ({
      displayName: p.displayName,
      playerIndex: p.playerIndex,
    })),
  };

  io.to(room.roomCode).emit('game:started', payload);
}

/** Called when a player sends a move. Validates, applies, and broadcasts.
 *  Pass `rm` to override the room manager (for tests). */
export function handleMove(
  io: Server,
  socket: Socket,
  payload: MakeMovePayload,
  rm: RoomManagerInstance = defaultRoomManager
): void {
  const room = rm.getRoom(payload.roomCode);
  if (!room || room.status !== 'active' || !room.gameState) {
    socket.emit('error', { message: 'No active game in this room' });
    return;
  }

  // Find which player this socket is
  const player = room.players.find((p) => p.socketId === socket.id);
  if (!player) {
    socket.emit('error', { message: 'You are not a player in this room' });
    return;
  }

  const gameState = room.gameState;
  const expectedSymbol = gameState.currentPlayer; // 'X' or 'O'
  const playerSymbol = player.playerIndex === 0 ? 'X' : 'O';

  if (playerSymbol !== expectedSymbol) {
    socket.emit('error', { message: 'Not your turn' });
    return;
  }

  const engine = getEngine(room.variantId);
  const result = engine.applyMove(
    gameState,
    { data: { boardIndex: payload.boardIndex, cellIndex: payload.cellIndex } },
    playerSymbol
  );

  if (!result.ok) {
    socket.emit('error', { message: result.error ?? 'Illegal move' });
    return;
  }

  room.gameState = result.state;
  const moveRecord: MoveRecord = {
    boardIndex: payload.boardIndex,
    cellIndex: payload.cellIndex,
    player: playerSymbol,
  };
  room.moveHistory.push(moveRecord);
  const terminal = engine.checkTerminal(room.gameState);

  if (terminal !== null) {
    room.status = 'finished';
    const winnerPlayer =
      terminal.winner !== null
        ? room.players.find((p) => (p.playerIndex === 0 ? 'X' : 'O') === terminal.winner)
        : null;

    const gameOverPayload: GameOverPayload = {
      gameState: room.gameState,
      winner: terminal.winner,
      reason: terminal.reason,
      winnerDisplayName: winnerPlayer?.displayName ?? null,
    };
    reportResult(room, terminal.winner, terminal.reason);
    io.to(room.roomCode).emit('game:over', gameOverPayload);
  } else {
    const updatePayload: GameStateUpdatePayload = {
      gameState: room.gameState,
      lastMove: { boardIndex: payload.boardIndex, cellIndex: payload.cellIndex },
    };
    io.to(room.roomCode).emit('game:state', updatePayload);
  }
}

/** Called when a player's socket disconnects. Starts the grace-period timer.
 *  Pass `rm` to override the room manager (for tests). */
export function handleDisconnect(
  io: Server,
  roomCode: string,
  disconnectedGuestId: string,
  rm: RoomManagerInstance = defaultRoomManager
): void {
  const room = rm.getRoom(roomCode);
  if (!room || room.status !== 'active') return;

  // Notify the room
  io.to(roomCode).emit('player:disconnected', { guestId: disconnectedGuestId });

  // Start the grace-period timer
  room.disconnectTimer = setTimeout(() => {
    // Check if the room still exists and the player is still disconnected
    const current = rm.getRoom(roomCode);
    if (!current || current.status !== 'active') return;

    const stillDisconnected = current.players.find(
      (p) => p.guestId === disconnectedGuestId && p.socketId === ''
    );

    if (stillDisconnected) {
      // Forfeit: the other player wins
      current.status = 'finished';
      const winner = current.players.find((p) => p.guestId !== disconnectedGuestId);
      const winnerSymbol: 'X' | 'O' | null = winner
        ? winner.playerIndex === 0
          ? 'X'
          : 'O'
        : null;

      if (!current.gameState) return; // guard: should not happen in active game

      const payload: GameOverPayload = {
        gameState: current.gameState,
        winner: winnerSymbol,
        reason: 'forfeit',
        winnerDisplayName: winner?.displayName ?? null,
      };
      reportResult(current, winnerSymbol, 'forfeit');
      io.to(roomCode).emit('game:over', payload);
    }
  }, DISCONNECT_GRACE_MS);
}

/** Called when a disconnected player reconnects. Cancels the grace-period timer. */
export function handleReconnect(io: Server, room: RoomState, newSocketId: string): void {
  if (room.disconnectTimer) {
    clearTimeout(room.disconnectTimer);
    room.disconnectTimer = null;
  }

  // Find which player is reconnecting (their socketId was just updated to newSocketId)
  const reconnectingPlayer = room.players.find((p) => p.socketId === newSocketId);

  // Send them the current game state + their own playerIndex so the client can restore identity
  io.to(newSocketId).emit('game:reconnect', {
    gameState: room.gameState,
    myPlayerIndex: reconnectingPlayer?.playerIndex ?? 0,
    players: room.players.map((p) => ({
      displayName: p.displayName,
      playerIndex: p.playerIndex,
    })),
  });

  io.to(room.roomCode).emit('player:reconnected', { socketId: newSocketId });
}
