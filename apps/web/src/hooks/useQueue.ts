'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket-client';

type QueueState = 'idle' | 'waiting' | 'matched';

interface UseQueueResult {
  queueState: QueueState;
  position: number;
  join: (variantId: string, guestId: string, displayName: string) => void;
  joinRated: (variantId: string, guestId: string, userId: string, displayName: string) => void;
  leave: () => void;
  matchedRoomCode: string | null;
  matchedPlayerIndex: number | null;
  matchedRated: boolean | null;
}

export function useQueue(): UseQueueResult {
  const [queueState, setQueueState] = useState<QueueState>('idle');
  const [position, setPosition] = useState(0);
  const [matchedRoomCode, setMatchedRoomCode] = useState<string | null>(null);
  const [matchedPlayerIndex, setMatchedPlayerIndex] = useState<number | null>(null);
  const [matchedRated, setMatchedRated] = useState<boolean | null>(null);
  const listenersAttached = useRef(false);

  useEffect(() => {
    if (listenersAttached.current) return;
    listenersAttached.current = true;
    const socket = getSocket();

    const onStatus = ({ position }: { position: number }) => {
      setPosition(position);
      setQueueState('waiting');
    };

    const onMatched = ({ roomCode, playerIndex, rated }: { roomCode: string; playerIndex: number; rated?: boolean }) => {
      setQueueState('matched');
      setMatchedRoomCode(roomCode);
      setMatchedPlayerIndex(playerIndex);
      setMatchedRated(rated ?? false);
    };

    const onLeft = () => {
      setQueueState('idle');
      setPosition(0);
    };

    socket.on('queue:status', onStatus);
    socket.on('queue:matched', onMatched);
    socket.on('queue:left', onLeft);

    return () => {
      socket.off('queue:status', onStatus);
      socket.off('queue:matched', onMatched);
      socket.off('queue:left', onLeft);
      listenersAttached.current = false;
    };
  }, []);

  const join = useCallback((variantId: string, guestId: string, displayName: string) => {
    const socket = getSocket();
    setQueueState('waiting');
    socket.emit('queue:join', { variantId, guestId, displayName });
  }, []);

  const joinRated = useCallback((variantId: string, guestId: string, userId: string, displayName: string) => {
    const socket = getSocket();
    setQueueState('waiting');
    socket.emit('queue:join:rated', { variantId, guestId, userId, displayName });
  }, []);

  const leave = useCallback(() => {
    const socket = getSocket();
    socket.emit('queue:leave');
  }, []);

  return { queueState, position, join, joinRated, leave, matchedRoomCode, matchedPlayerIndex, matchedRated };
}
