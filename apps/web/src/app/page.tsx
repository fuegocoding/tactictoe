'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useGuestSession } from '@/hooks/useGuestSession';
import { useQueue } from '@/hooks/useQueue';
import { useSocket } from '@/hooks/useSocket';
import { getSocket } from '@/lib/socket-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import RatingBadge from '@/components/RatingBadge';
import HeroBoard from '@/components/HeroBoard';
import { Grip, Table2, Grid3x3, Target, Ban, Asterisk, Type, Hash, HelpCircle } from 'lucide-react';
import styles from './page.module.css';

type TabId = 'quick' | 'private' | 'ranked';
type VariantId = 'ultimate_ttt' | 'standard_3x3' | 'gomoku' | 'misere_ttt' | 'notakto_ttt' | 'wild_ttt' | 'sos_ttt' | 'numerical_ttt';

const VARIANTS: { id: VariantId; label: string; description: string; Icon: any }[] = [
  { id: 'ultimate_ttt', label: 'Ultimate', description: '9 boards in one. The flagship.', Icon: Table2 },
  { id: 'gomoku', label: 'Gomoku', description: '15x15 board. First to 5 in a row wins. Deep strategy.', Icon: Grip },
  { id: 'standard_3x3', label: 'Standard', description: 'Classic. Quick casual games.', Icon: Grid3x3 },
  { id: 'misere_ttt', label: 'Misère', description: 'Force your opponent to get 3-in-a-row to win.', Icon: Target },
  { id: 'notakto_ttt', label: 'Notakto', description: 'Both players place X. Avoid making 3-in-a-row!', Icon: Ban },
  { id: 'wild_ttt', label: 'Wild', description: 'Choose to place X or O on every turn.', Icon: Asterisk },
  { id: 'sos_ttt', label: 'SOS', description: 'Place S or O to spell S-O-S for points + extra turns.', Icon: Type },
  { id: 'numerical_ttt', label: 'Numerical', description: 'Place numbers to sum precisely to 15.', Icon: Hash },
];

export default function LobbyPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const guestSession = useGuestSession();
  const queue = useQueue();
  useSocket(); // Explicitly connect the socket on the lobby page

  const [tab, setTab] = useState<TabId>('quick');
  const [variant, setVariant] = useState<VariantId>('ultimate_ttt');
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myRating, setMyRating] = useState<{ rating: number; rd: number; wins: number; losses: number } | null>(null);

  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/ratings/me?variant=ultimate_ttt').then(res => res.json()).then(data => {
        if (data.rating) setMyRating(data.rating);
      });
    }
  }, [session]);

  // When matched, store playerIndex and redirect
  useEffect(() => {
    if (queue.queueState === 'matched' && queue.matchedRoomCode !== null && queue.matchedPlayerIndex !== null) {
      sessionStorage.setItem(`room:${queue.matchedRoomCode}:playerIndex`, String(queue.matchedPlayerIndex));
      if (queue.matchedRated) sessionStorage.setItem(`room:${queue.matchedRoomCode}:rated`, 'true');
      router.push(`/room/${queue.matchedRoomCode}`);
    }
  }, [queue.queueState, queue.matchedRoomCode, queue.matchedPlayerIndex, queue.matchedRated, router]);

  const handleQuickMatch = () => {
    if (!guestSession) return;
    queue.join(variant, guestSession.guestId, session?.user?.name ?? guestSession.displayName);
  };

  const handleRankedMatch = () => {
    if (!guestSession || !session?.user?.id) return;
    queue.joinRated('ultimate_ttt', guestSession.guestId, session.user.id, session.user.name ?? guestSession.displayName);
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
      <div className={styles.twoColumn}>
        <div className={styles.leftColumn}>
          <div className={styles.hero}>
            <h1 className={styles.title} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'inherit' }}>
              <Grid3x3 size={36} strokeWidth={2.5} style={{ color: 'var(--accent)' }} />
              <div>
                <span style={{ color: 'var(--mark-x)' }}>TIC</span>
                <span style={{ color: 'var(--text)' }}>TAC</span>
                <span style={{ color: 'var(--accent)' }}>TOP</span>
              </div>
            </h1>
            <p className={styles.subtitle}>Competitive Tic-Tac-Toe and its deeper variants.</p>
            {myRating && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <RatingBadge rating={myRating.rating} rd={myRating.rd} wins={myRating.wins} losses={myRating.losses} />
              </div>
            )}
          </div>
          <HeroBoard />
        </div>

        <div className={styles.rightColumn}>
          {error && <div className={styles.error}>{error}</div>}

          <Card style={{ width: '100%' }}>
        <div className={styles.variantRow}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p className={styles.variantLabel}>Game mode</p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
              <div className={styles.variantInfo} title={VARIANTS.find(v => v.id === variant)?.description}>
                <HelpCircle size={14} style={{ marginRight: 4 }} />
                {VARIANTS.find(v => v.id === variant)?.description}
              </div>
              <a href={`/learn#${variant}`} className={styles.learnMoreLink}>
                Learn more →
              </a>
            </div>
          </div>
          <div className={styles.variantButtons}>
            {VARIANTS.map(({ id, label, Icon }) => (
              <button
                key={id}
                className={`${styles.variantBtn} ${variant === id ? styles.selected : ''}`}
                onClick={() => setVariant(id)}
              >
                <Icon size={16} strokeWidth={2.5} style={{ marginBottom: 4 }} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Play mode tabs */}
        <div className={styles.tabs} style={{ marginTop: 'var(--space-5)' }}>
          <button className={`${styles.tab} ${tab === 'quick' ? styles.activeTab : ''}`} onClick={() => setTab('quick')}>
            Quick Match
          </button>
          <button className={`${styles.tab} ${tab === 'ranked' ? styles.activeTab : ''}`} onClick={() => { setTab('ranked'); setVariant('ultimate_ttt'); }}>
            Ranked
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

        {tab === 'ranked' && (
          <div className={styles.section}>
            {!session ? (
              <>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                  Rated games require an account. Your rating is permanent and tracked across sessions.
                </p>
                <Button onClick={() => router.push('/login')} variant="secondary" full>Sign in to play ranked</Button>
              </>
            ) : queue.queueState === 'waiting' ? (
              <>
                <div className={styles.queueStatus}>
                  <div className={styles.queueDot} />
                  Finding rated opponent…
                </div>
                <Button variant="secondary" onClick={handleCancelQueue} full>Cancel</Button>
              </>
            ) : (
              <>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                  Ultimate TTT · Rated · All time controls standard
                </p>
                <Button onClick={handleRankedMatch} full>Find Ranked Match</Button>
              </>
            )}
          </div>
        )}
          </Card>

          <p className={styles.localLink}>
            Playing with someone next to you?{' '}
            <Link href="/local">Play locally on this screen →</Link>
          </p>

          <p className={styles.localLink}>
            Want to practice?{' '}
            <Link href="/vs-ai">Play vs AI →</Link>
          </p>

          {!session && (
            <p className={styles.guestCta}>
              Playing as guest.{' '}
              <Link href="/register">Create an account</Link>{' '}
              to track your rating and match history.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
