'use client';

import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket-client';

export type SocketStatus = 'disconnected' | 'connecting' | 'connected';

export interface UseSocketResult {
  socket: Socket;
  status: SocketStatus;
}

export function useSocket(): UseSocketResult {
  const socket = useRef<Socket>(getSocket());

  // Initialize status from the actual socket state to handle the already-connected case.
  const [status, setStatus] = useState<SocketStatus>(
    () => (socket.current.connected ? 'connected' : 'disconnected')
  );

  useEffect(() => {
    const s = socket.current;

    const onConnect = () => setStatus('connected');
    const onDisconnect = () => setStatus('disconnected');
    const onConnectError = () => setStatus('disconnected');

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);

    if (!s.connected) {
      setStatus('connecting');
      s.connect();
    }

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      // Do NOT disconnect on unmount — the socket is a singleton.
    };
  }, []);

  return { socket: socket.current, status };
}
