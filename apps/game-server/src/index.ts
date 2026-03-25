import { createServer } from 'http';
import { randomInt } from 'node:crypto';
import { Server } from 'socket.io';
import { GAME_VARIANTS } from '@tactictoe/game-engine';
import { roomManager } from './room-manager.js';
import { QueueManager } from './queue-manager.js';
import { startGame, handleMove, handleDisconnect, handleReconnect } from './game-session.js';
import type {
  CreateRoomPayload,
  JoinRoomPayload,
  MakeMovePayload,
  ConnectedPlayer,
  JoinQueuePayload,
  JoinRatedQueuePayload,
  QueueMatchedPayload,
  QueueStatusPayload,
} from './types.js';

const CASUAL_VARIANTS = new Set(GAME_VARIANTS.filter(v => v.allowCasual).map(v => v.id));
const RATED_VARIANTS = new Set(GAME_VARIANTS.filter(v => v.allowRated).map(v => v.id));

const PORT = parseInt(process.env['PORT'] ?? '4000', 10);
const CLIENT_URL = process.env['CLIENT_URL'] ?? 'http://localhost:3000';

// ─── HTTP + Socket.io setup ───────────────────────────────────────────────────

const httpServer = createServer((req, res) => {
  // Basic health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', rooms: roomManager.activeCount }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateDisplayName(): string {
  return `Guest#${randomInt(1000, 10000)}`;
}

const qm = new QueueManager();

// ─── Socket.io event handlers ─────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ── Create room ──────────────────────────────────────────────────────────────
  socket.on('room:create', (payload: CreateRoomPayload) => {
    try {
      const code = roomManager.generateCode();
      const host: ConnectedPlayer = {
        socketId: socket.id,
        guestId: payload.guestId,
        displayName: payload.displayName || generateDisplayName(),
        playerIndex: 0, // host is always X
      };
      roomManager.createRoom(code, host, payload.variantId ?? 'ultimate_ttt');
      socket.join(code);
      socket.emit('room:created', { roomCode: code, playerIndex: 0 });
      console.log(`[room:create] code=${code} host=${host.displayName}`);
    } catch (err) {
      socket.emit('error', { message: (err as Error).message });
    }
  });

  // ── Join room ────────────────────────────────────────────────────────────────
  socket.on('room:join', (payload: JoinRoomPayload) => {
    const room = roomManager.getRoom(payload.roomCode);

    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Check if this is a returning player (either from matchmaking with socketId='',
    // a mid-game reconnect, or just a page reload/React Strict Mode double-firing).
    const existingPlayer = room.players.find((p) => p.guestId === payload.guestId);

    if (existingPlayer) {
      // Use roomManager to properly clear any disconnect timers
      roomManager.reconnectPlayer(room, payload.guestId, socket.id);
      socket.join(payload.roomCode);

      if (room.status === 'active') {
        // Mid-game reconnect — restore state
        handleReconnect(io, room, socket.id);
        console.log(`[room:reconnect] code=${payload.roomCode} guest=${payload.guestId}`);
      } else if (room.status === 'finished') {
        // Post-game reconnect
        socket.emit('game:reconnect', {
          gameState: room.gameState,
          myPlayerIndex: existingPlayer.playerIndex,
          players: room.players.map((p) => ({ displayName: p.displayName, playerIndex: p.playerIndex })),
        });
      } else {
        // Matched or returning player arriving at waiting room — confirm their slot
        const playerList = room.players.map((p) => ({ displayName: p.displayName, playerIndex: p.playerIndex }));
        socket.emit('room:joined', { roomCode: payload.roomCode, playerIndex: existingPlayer.playerIndex, players: playerList });

        // Start the game once both players have arrived and have valid socketIds
        if (room.players.length === 2 && room.players.every((p) => p.socketId !== '')) {
          startGame(io, room);
        }
        console.log(`[room:ready] code=${payload.roomCode} guest=${payload.guestId} playerIndex=${existingPlayer.playerIndex}`);
      }
      return;
    }

    if (room.players.length >= 2) {
      // Join as spectator
      roomManager.addSpectator(room, socket.id);
      socket.join(payload.roomCode);
      socket.emit('room:spectating', { roomCode: payload.roomCode });
      
      // If the game is already playing or finished, synchronize the board immediately
      if ((room.status === 'active' || room.status === 'finished') && room.gameState) {
        socket.emit('game:spectator_sync', {
          gameState: room.gameState,
          players: room.players.map((p) => ({ displayName: p.displayName, playerIndex: p.playerIndex }))
        });
      }
      return;
    }

    if (room.status !== 'waiting') {
      socket.emit('error', { message: 'Game already in progress' });
      return;
    }

    const joiner: ConnectedPlayer = {
      socketId: socket.id,
      guestId: payload.guestId,
      displayName: payload.displayName || generateDisplayName(),
      playerIndex: 1, // second player is O
    };

    roomManager.addPlayer(room, joiner);
    socket.join(payload.roomCode);

    const joinedPayload = {
      roomCode: payload.roomCode,
      playerIndex: 1,
      players: room.players.map((p) => ({ displayName: p.displayName, playerIndex: p.playerIndex })),
    };
    socket.emit('room:joined', joinedPayload);

    // Both players present — start the game
    if (room.players.length === 2) {
      startGame(io, room);
    }

    console.log(`[room:join] code=${payload.roomCode} joiner=${joiner.displayName}`);
  });

  // ── Make move ────────────────────────────────────────────────────────────────
  socket.on('game:move', (payload: MakeMovePayload) => {
    handleMove(io, socket, payload);
  });

  // ── Queue ────────────────────────────────────────────────────────────────────
  socket.on('queue:join', (payload: JoinQueuePayload) => {
    const { variantId, guestId, displayName } = payload;

    if (!CASUAL_VARIANTS.has(variantId)) {
      socket.emit('error', { message: 'Unknown variant' });
      return;
    }

    qm.join(variantId, { socketId: socket.id, guestId, displayName, joinedAt: Date.now() });

    const pair = qm.tryMatch(variantId);
    if (pair) {
      const [p1, p2] = pair;
      const code = roomManager.generateCode();

      // socketId: '' — players are pre-assigned but not yet on the room page.
      // startGame() is deferred until both emit room:join from the room page.
      const host: ConnectedPlayer = { socketId: '', guestId: p1.guestId, displayName: p1.displayName, playerIndex: 0 };
      roomManager.createRoom(code, host, variantId);
      const room = roomManager.getRoom(code)!;

      const guest: ConnectedPlayer = { socketId: '', guestId: p2.guestId, displayName: p2.displayName, playerIndex: 1 };
      roomManager.addPlayer(room, guest);

      const p1Socket = io.sockets.sockets.get(p1.socketId);
      const p2Socket = io.sockets.sockets.get(p2.socketId);

      const matchPayloadP1: QueueMatchedPayload = { roomCode: code, playerIndex: 0 };
      const matchPayloadP2: QueueMatchedPayload = { roomCode: code, playerIndex: 1 };

      p1Socket?.emit('queue:matched', matchPayloadP1);
      p2Socket?.emit('queue:matched', matchPayloadP2);
    } else {
      const position = qm.getPosition(socket.id);
      socket.emit('queue:status', { position, variantId } satisfies QueueStatusPayload);
    }
  });

  socket.on('queue:join:rated', (payload: JoinRatedQueuePayload) => {
    const { variantId, guestId, userId, displayName } = payload;

    if (!RATED_VARIANTS.has(variantId)) {
      socket.emit('error', { message: 'This variant is not available for rated play' });
      return;
    }

    qm.joinRated(variantId, { socketId: socket.id, guestId, userId, displayName, joinedAt: Date.now() });

    const pair = qm.tryMatchRated(variantId);
    if (pair) {
      const [p1, p2] = pair;
      const code = roomManager.generateCode();

      // socketId: '' — players are pre-assigned but not yet on the room page.
      // startGame() is deferred until both emit room:join from the room page.
      const host: ConnectedPlayer = { socketId: '', guestId: p1.guestId, userId: p1.userId, displayName: p1.displayName, playerIndex: 0 };
      roomManager.createRoom(code, host, variantId, true);
      const room = roomManager.getRoom(code)!;

      const guest: ConnectedPlayer = { socketId: '', guestId: p2.guestId, userId: p2.userId, displayName: p2.displayName, playerIndex: 1 };
      roomManager.addPlayer(room, guest);

      const p1Socket = io.sockets.sockets.get(p1.socketId);
      const p2Socket = io.sockets.sockets.get(p2.socketId);

      const matchPayloadP1: QueueMatchedPayload = { roomCode: code, playerIndex: 0, rated: true };
      const matchPayloadP2: QueueMatchedPayload = { roomCode: code, playerIndex: 1, rated: true };

      p1Socket?.emit('queue:matched', matchPayloadP1);
      p2Socket?.emit('queue:matched', matchPayloadP2);
    } else {
      const position = qm.getPosition(socket.id);
      socket.emit('queue:status', { position, variantId, rated: true } satisfies QueueStatusPayload);
    }
  });

  socket.on('queue:leave', () => {
    qm.leave(socket.id);
    socket.emit('queue:left', {});
  });

  // ── Disconnect ───────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    qm.leave(socket.id);
    const result = roomManager.removeSocket(socket.id);
    if (result?.wasPlayer) {
      const room = roomManager.getRoom(result.roomCode);
      if (room) {
        const disconnectedPlayer = room.players.find((p) => p.socketId === '');
        if (disconnectedPlayer) {
          handleDisconnect(io, result.roomCode, disconnectedPlayer.guestId);
        }
      }
    }
  });
});

// ─── Cleanup expired rooms every 5 minutes ───────────────────────────────────

setInterval(() => {
  const purged = roomManager.purgeExpired();
  if (purged > 0) console.log(`[cleanup] purged ${purged} expired rooms`);
}, 5 * 60 * 1000);

// ─── Start listening ──────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`Game server listening on port ${PORT}`);
  console.log(`CORS origin: ${CLIENT_URL}`);
});
