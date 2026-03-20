'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useGuestSession } from '@/hooks/useGuestSession';
import { getSocket } from '@/lib/socket-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import styles from './page.module.css';

export default function LobbyPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const guestSession = useGuestSession();
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = () => {
    if (!guestSession) return;
    setCreating(true);
    setError(null);
    const socket = getSocket();
    socket.emit('room:create', {
      guestId: guestSession.guestId,
      displayName: session?.user?.name ?? guestSession.displayName,
      variantId: 'ultimate_ttt',
    });
    socket.once('room:created', ({ roomCode, playerIndex }: { roomCode: string; playerIndex: number }) => {
      sessionStorage.setItem(`room:${roomCode}:playerIndex`, String(playerIndex));
      router.push(`/room/${roomCode}`);
    });
    socket.once('error', ({ message }: { message: string }) => {
      setError(message);
      setCreating(false);
    });
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) { setError('Room code must be 6 characters'); return; }
    router.push(`/room/${code}`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Tactic<span>Toe</span></h1>
        <p className={styles.subtitle}>Competitive Tic-Tac-Toe and its deeper variants.</p>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <Card>
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Online — Ultimate TTT</p>
          <Button onClick={handleCreateRoom} loading={creating} full>
            Create Room
          </Button>
        </div>

        <div className={styles.divider} style={{ margin: 'var(--space-5) 0' }}>or</div>

        <form onSubmit={handleJoinRoom}>
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Join by code</p>
            <div className={styles.joinRow}>
              <Input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="XXXXXX"
                maxLength={6}
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.15em', textTransform: 'uppercase' }}
              />
              <Button type="submit" variant="secondary">Join</Button>
            </div>
          </div>
        </form>
      </Card>

      <p className={styles.localLink}>
        Playing with someone next to you?{' '}
        <Link href="/local">Play locally on this screen →</Link>
      </p>

      {!session && (
        <p className={styles.guestCta}>
          Playing as guest.{' '}
          <Link href="/register">Create an account</Link>{' '}
          to track your rating and match history.
        </p>
      )}
    </div>
  );
}
