'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket-client';
import { useGuestSession } from '@/hooks/useGuestSession';
import { useSession } from 'next-auth/react';

export default function LobbyPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const guest = useGuestSession();
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCreateRoom() {
    if (!guest) {
      setError('Session loading — please try again in a moment.');
      return;
    }

    setCreating(true);
    setError(null);

    const socket = getSocket();

    function onRoomCreated({ roomCode, playerIndex }: { roomCode: string; playerIndex: number }) {
      socket.off('room:created', onRoomCreated);
      // Store our playerIndex so the room page knows our symbol without re-joining
      sessionStorage.setItem(`room:${roomCode}:playerIndex`, String(playerIndex));
      router.push(`/room/${roomCode}`);
    }

    socket.on('room:created', onRoomCreated);

    if (!socket.connected) {
      socket.connect();
      socket.once('connect', () => {
        socket.emit('room:create', {
          guestId: guest.guestId,
          displayName: session?.user?.name ?? guest.displayName,
          variantId: 'ultimate_ttt',
        });
      });
    } else {
      socket.emit('room:create', {
        guestId: guest.guestId,
        displayName: session?.user?.name ?? guest.displayName,
        variantId: 'ultimate_ttt',
      });
    }
  }

  function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setError('Room code must be 6 characters');
      return;
    }
    router.push(`/room/${code}`);
  }

  return (
    <main style={{ maxWidth: 600, margin: '60px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>TacticToe</h1>
      <p style={{ color: '#9ca3af', marginBottom: 32 }}>
        Competitive Tic-Tac-Toe. Think before you play.
      </p>

      {/* Create room */}
      <section style={{ marginBottom: 32 }}>
        <p style={{ marginBottom: 8, color: '#d1d5db' }}>
          Variant: <strong>Ultimate TTT</strong>
        </p>
        <button
          onClick={handleCreateRoom}
          disabled={creating || !guest}
          style={{ padding: '12px 28px', fontSize: 18, cursor: 'pointer', borderRadius: 8 }}
        >
          {creating ? 'Creating room…' : 'Play Now'}
        </button>
      </section>

      {/* Join by code */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Join with Room Code</h2>
        <form onSubmit={handleJoinRoom} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="6-char code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            style={{ padding: 8, fontSize: 16, width: 160, letterSpacing: 4, textTransform: 'uppercase' }}
          />
          <button type="submit" style={{ padding: '8px 16px', fontSize: 16 }}>
            Join
          </button>
        </form>
      </section>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Auth CTA for guests */}
      {!session?.user && (
        <section style={{ marginTop: 40, padding: 16, border: '1px solid #374151', borderRadius: 8 }}>
          <p style={{ margin: 0 }}>
            Playing as <strong>{guest?.displayName ?? '…'}</strong>.{' '}
            <a href="/register">Create an account</a> to track your rating.
          </p>
        </section>
      )}
    </main>
  );
}
