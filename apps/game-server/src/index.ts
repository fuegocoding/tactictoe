import { createServer } from 'http';
import { Server } from 'socket.io';
import { roomManager } from './room-manager.js';
import { startGame, handleMove, handleDisconnect, handleReconnect } from './game-session.js';
import type {
  CreateRoomPayload,
  JoinRoomPayload,
  MakeMovePayload,
  ConnectedPlayer,
} from './types.js';

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
  return `Guest#${Math.floor(1000 + Math.random() * 9000)}`;
}

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

    // Check if this is a reconnection (guestId matches a disconnected player)
    const reconnectingPlayer = room.players.find(
      (p) => p.guestId === payload.guestId && p.socketId === ''
    );

    if (reconnectingPlayer) {
      roomManager.reconnectPlayer(room, payload.guestId, socket.id);
      socket.join(payload.roomCode);
      handleReconnect(io, room, socket.id);
      console.log(`[room:reconnect] code=${payload.roomCode} guest=${payload.guestId}`);
      return;
    }

    // New player joining
    if (room.players.length >= 2) {
      // Join as spectator
      roomManager.addSpectator(room, socket.id);
      socket.join(payload.roomCode);
      socket.emit('room:spectating', { roomCode: payload.roomCode });
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

  // ── Disconnect ───────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
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
