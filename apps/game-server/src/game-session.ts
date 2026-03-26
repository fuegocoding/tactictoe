import type { Server, Socket } from 'socket.io';
import { UltimateTTT, StandardTTT, Gomoku, WildTTT, SOSTTT, MisereTTT, NotaktoTTT, NumericalTTT, VanishingTTT, TTT3D, TTT4D, OrderChaos, TacticToe, Ultimate3D, Garrison, type GameRules, type GameState } from '@tactictoe/game-engine';
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

// ─── Rate limiting for chat ────────────────────────────────────────────────────
const messageCooldowns = new Map<string, number>();
const RATE_LIMIT_MS = 1000; // 1 message per second

// ─── XSS sanitization for chat ─────────────────────────────────────────────────
/** Encode HTML special characters to prevent XSS attacks */
function sanitizeHtml(str: string): string {
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function reportResult(io: Server, room: RoomState, winner: 'X' | 'O' | null, reason: string) {
  if (!WEB_SERVER_URL) return;
  const [p1, p2] = room.players;
  if (!p1 || !p2) return;

  try {
    const res = await fetch(`${WEB_SERVER_URL}/api/ratings/update`, {
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
    const data = await res.json() as any;
    if (data?.matchId) {
      io.to(room.roomCode).emit('game:match_saved', { matchId: data.matchId });
    }
  } catch (err) {
    console.error('Failed to report game result:', err);
    // Non-fatal — game continues even if rating update fails
  }
}

const engines: Record<string, GameRules> = {
  ultimate_ttt: new UltimateTTT(),
  standard_3x3: new StandardTTT(),
  gomoku: new Gomoku(),
  wild_ttt: new WildTTT(),
  sos_ttt: new SOSTTT(),
  misere_ttt: new MisereTTT(),
  notakto_ttt: new NotaktoTTT(),
  numerical_ttt: new NumericalTTT(),
  vanishing_ttt: new VanishingTTT(),
  ttt_3d: new TTT3D(),
  ttt_4d: new TTT4D(),
  order_chaos: new OrderChaos(),
  tactic_toe: new TacticToe(),
  ultimate_3d: new Ultimate3D(),
  garrison: new Garrison(),
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
  room.drawOfferPending = null; // Initialize draw offer state

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

  const moveData =
    room.variantId === 'ultimate_ttt' ? { boardIndex: payload.boardIndex, cellIndex: payload.cellIndex } :
    (room.variantId === 'wild_ttt' || room.variantId === 'sos_ttt') ? { cellIndex: payload.cellIndex, symbol: payload.symbol } :
    room.variantId === 'numerical_ttt' ? { cellIndex: payload.cellIndex, numberPlaced: payload.numberPlaced } :
    room.variantId === 'garrison' ? (
      payload.garrisonType === 'place'
        ? { type: 'place', pieceId: payload.garrisonPieceId, to: payload.garrisonTo }
        : { type: 'move', pieceId: payload.garrisonPieceId, from: payload.garrisonFrom, to: payload.garrisonTo }
    ) :
    { cellIndex: payload.cellIndex };

  const result = engine.applyMove(
    gameState,
    { data: moveData },
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
    room.drawOfferPending = null; // Clear any pending draw offer
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
    reportResult(io, room, terminal.winner, terminal.reason);
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
      current.drawOfferPending = null; // Clear any pending draw offer
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
      reportResult(io, current, winnerSymbol, 'forfeit');
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

/** Called when a player sends a chat message. Broadcasts to the room. */
export function handleChatMessage(
  io: Server,
  socket: Socket,
  guestId: string,
  displayName: string,
  roomCode: string,
  message: string,
  rm: RoomManagerInstance = defaultRoomManager
): void {
  const room = rm.getRoom(roomCode);
  if (!room) {
    socket.emit('error', { message: 'Room not found' });
    return;
  }

  // Validate that the sender is a player in the room (not a spectator)
  const player = room.players.find((p) => p.guestId === guestId);
  if (!player) {
    socket.emit('error', { message: 'Only players can send chat messages' });
    return;
  }

  // Rate limiting check
  const lastMessage = messageCooldowns.get(guestId);
  if (lastMessage && Date.now() - lastMessage < RATE_LIMIT_MS) {
    socket.emit('error', { message: 'Please wait before sending another message' });
    return;
  }
  messageCooldowns.set(guestId, Date.now());

  // Validate message
  const trimmedMessage = message.trim();
  if (!trimmedMessage) return;
  if (trimmedMessage.length > 500) {
    socket.emit('error', { message: 'Message too long (max 500 characters)' });
    return;
  }

  // Broadcast the message to everyone in the room (sanitized for XSS)
  io.to(roomCode).emit('chat:message', {
    guestId,
    displayName,
    message: sanitizeHtml(trimmedMessage),
    timestamp: Date.now(),
  });
}

/** Called when a player offers a draw. Notifies the opponent. */
export function handleDrawOffer(
  io: Server,
  socket: Socket,
  guestId: string,
  displayName: string,
  roomCode: string,
  rm: RoomManagerInstance = defaultRoomManager
): void {
  const room = rm.getRoom(roomCode);
  if (!room || room.status !== 'active') {
    socket.emit('error', { message: 'No active game in this room' });
    return;
  }

  const player = room.players.find((p) => p.guestId === guestId);
  if (!player) {
    socket.emit('error', { message: 'You are not a player in this room' });
    return;
  }

  // Check if there's already a pending draw offer
  if (room.drawOfferPending) {
    socket.emit('error', { message: 'A draw offer is already pending' });
    return;
  }

  // Set the pending draw offer state
  room.drawOfferPending = { fromGuestId: guestId };

  // Notify the opponent about the draw offer
  const opponent = room.players.find((p) => p.guestId !== guestId);
  if (opponent) {
    io.to(opponent.socketId).emit('draw:offered', {
      fromGuestId: guestId,
      fromDisplayName: displayName,
    });
  }

  // Confirm to the sender
  socket.emit('draw:offer_sent', {});
}

/** Called when a player responds to a draw offer. */
export function handleDrawResponse(
  io: Server,
  socket: Socket,
  guestId: string,
  roomCode: string,
  accepted: boolean,
  rm: RoomManagerInstance = defaultRoomManager
): void {
  const room = rm.getRoom(roomCode);
  if (!room || room.status !== 'active') {
    socket.emit('error', { message: 'No active game in this room' });
    return;
  }

  const player = room.players.find((p) => p.guestId === guestId);
  if (!player) {
    socket.emit('error', { message: 'You are not a player in this room' });
    return;
  }

  // Validate there's a pending draw offer
  if (!room.drawOfferPending) {
    socket.emit('error', { message: 'No draw offer to respond to' });
    return;
  }

  // Validate the responder is the opponent (not the offerer)
  if (room.drawOfferPending.fromGuestId === guestId) {
    socket.emit('error', { message: 'Cannot respond to your own draw offer' });
    return;
  }

  if (accepted) {
    // End the game as a draw
    room.status = 'finished';
    room.drawOfferPending = null;
    
    const gameOverPayload: GameOverPayload = {
      gameState: room.gameState!,
      winner: null,
      reason: 'draw',
      winnerDisplayName: null,
    };
    
    reportResult(io, room, null, 'draw');
    io.to(roomCode).emit('game:over', gameOverPayload);
  } else {
    // Notify the opponent that the draw was declined
    const opponent = room.players.find((p) => p.guestId !== guestId);
    if (opponent) {
      io.to(opponent.socketId).emit('draw:declined', {});
    }
    // Clear the pending draw offer
    room.drawOfferPending = null;
  }
}

/** Called when a player forfeits the game. */
export function handleForfeit(
  io: Server,
  socket: Socket,
  guestId: string,
  roomCode: string,
  rm: RoomManagerInstance = defaultRoomManager
): void {
  const room = rm.getRoom(roomCode);
  if (!room || room.status !== 'active') {
    socket.emit('error', { message: 'No active game in this room' });
    return;
  }

  const player = room.players.find((p) => p.guestId === guestId);
  if (!player) {
    socket.emit('error', { message: 'You are not a player in this room' });
    return;
  }

  // The forfeiting player loses
  room.status = 'finished';
  room.drawOfferPending = null; // Clear any pending draw offer
  const winnerSymbol: 'X' | 'O' = player.playerIndex === 0 ? 'O' : 'X';
  
  const winnerPlayer = room.players.find((p) => (p.playerIndex === 0 ? 'X' : 'O') === winnerSymbol);
  
  const gameOverPayload: GameOverPayload = {
    gameState: room.gameState!,
    winner: winnerSymbol,
    reason: 'forfeit',
    winnerDisplayName: winnerPlayer?.displayName ?? null,
  };
  
  reportResult(io, room, winnerSymbol, 'forfeit');
  io.to(roomCode).emit('game:over', gameOverPayload);
}
