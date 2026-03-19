import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = process.env['NEXT_PUBLIC_GAME_SERVER_URL'] ?? 'http://localhost:4000';
    socket = io(url, {
      autoConnect: false, // Explicit connect in useSocket
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}
