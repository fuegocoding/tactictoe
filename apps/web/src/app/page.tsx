'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useGuestSession } from '@/hooks/useGuestSession';
import { useQueue } from '@/hooks/useQueue';
import { getSocket } from '@/lib/socket-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import styles from './page.module.css';

type TabId = 'quick' | 'private';
type VariantId = 'ultimate_ttt' | 'standard_3x3';

const VARIANTS: { id: VariantId; label: string; description: string }[] = [
  { id: 'ultimate_ttt', label: 'Ultimate TTT', description: '9 boards in one. The flagship.' },
  { id: 'standard_3x3', label: 'Standard 3×3', description: 'Classic. Quick casual games.' },
];

export default function LobbyPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const guestSession = useGuestSession();
  const queue = useQueue();

  const [tab, setTab] = useState<TabId>('quick');
  const [variant, setVariant] = useState<VariantId>('ultimate_ttt');
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When matched, store playerIndex and redirect
  useEffect(() => {
    if (queue.queueState === 'matched' && queue.matchedRoomCode !== null && queue.matchedPlayerIndex !== null) {
      sessionStorage.setItem(`room:${queue.matchedRoomCode}:playerIndex`, String(queue.matchedPlayerIndex));
      router.push(`/room/${queue.matchedRoomCode}`);
    }
  }, [queue.queueState, queue.matchedRoomCode, queue.matchedPlayerIndex, router]);

  const handleQuickMatch = () => {
    if (!guestSession) return;
    queue.join(variant, guestSession.guestId, session?.user?.name ?? guestSession.displayName);
  };

  const handleCancelQueue = () => {
    queue.leave();
  };

  const handleCreateRoom = () => {
    if (!guestSession) return;
    setCreating(true);
    setError(null);
    const socket = getSocket();
    socket.emit('room:create', {
      guestId: guestSession.guestId,
      displayName: session?.user?.name ?? guestSession.displayName,
      variantId: variant,
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

      <Card style={{ width: '100%' }}>
        {/* Variant selector */}
        <div className={styles.variantRow}>
          <p className={styles.variantLabel}>Game mode</p>
          <div className={styles.variantButtons}>
            {VARIANTS.map(v => (
              <button
                key={v.id}
                className={`${styles.variantBtn} ${variant === v.id ? styles.selected : ''}`}
                onClick={() => setVariant(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Play mode tabs */}
        <div className={styles.tabs} style={{ marginTop: 'var(--space-5)' }}>
          <button className={`${styles.tab} ${tab === 'quick' ? styles.activeTab : ''}`} onClick={() => setTab('quick')}>
            Quick Match
          </button>
          <button className={`${styles.tab} ${tab === 'private' ? styles.activeTab : ''}`} onClick={() => setTab('private')}>
            Private Room
          </button>
        </div>

        {tab === 'quick' && (
          <div className={styles.section}>
            {queue.queueState === 'waiting' ? (
              <>
                <div className={styles.queueStatus}>
                  <div className={styles.queueDot} />
                  Finding opponent…
                </div>
                <Button variant="secondary" onClick={handleCancelQueue} full>Cancel</Button>
              </>
            ) : (
              <Button onClick={handleQuickMatch} full>Find Opponent</Button>
            )}
          </div>
        )}

        {tab === 'private' && (
          <div className={styles.section} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Button onClick={handleCreateRoom} loading={creating} full>Create Room</Button>

            <div className={styles.divider}>or join</div>

            <form onSubmit={handleJoinRoom}>
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
            </form>
          </div>
        )}
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
