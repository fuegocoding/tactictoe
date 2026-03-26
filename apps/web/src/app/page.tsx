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
import { GAME_VARIANTS } from '@tactictoe/game-engine';
import { Grip, Table2, Grid3x3, Target, Ban, Asterisk, Type, Hash, Eye, Layers, Box, Shuffle, Swords, Network, HelpCircle, Shield } from 'lucide-react';
import styles from './page.module.css';

type TabId = 'quick' | 'private' | 'ranked';

const VARIANT_ICONS: Record<string, any> = {
  ultimate_ttt:  Table2,
  standard_3x3:  Grid3x3,
  gomoku:        Grip,
  misere_ttt:    Target,
  notakto_ttt:   Ban,
  wild_ttt:      Asterisk,
  sos_ttt:       Type,
  numerical_ttt: Hash,
  vanishing_ttt: Eye,
  ttt_3d:        Layers,
  ttt_4d:        Box,
  order_chaos:   Shuffle,
  tactic_toe:    Swords,
  ultimate_3d:   Network,
  garrison:      Shield,
};

export default function LobbyPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const guestSession = useGuestSession();
  const queue = useQueue();
  useSocket(); // Explicitly connect the socket on the lobby page

  const [tab, setTab] = useState<TabId>('quick');
  const [variant, setVariant] = useState('ultimate_ttt');
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myRating, setMyRating] = useState<{ rating: number; rd: number; wins: number; losses: number } | null>(null);

  const handleTabChange = (newTab: TabId) => {
    setTab(newTab);
    if (newTab === 'ranked') {
      const selectedVariant = GAME_VARIANTS.find(v => v.id === variant);
      if (!selectedVariant?.allowRated) {
        setVariant('ultimate_ttt');
      }
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      fetch(`/api/ratings/me?variant=${variant}`).then(res => res.json()).then(data => {
        setMyRating(data.rating || null);
      });
    }
  }, [session, variant]);

  // When matched, store playerIndex and redirect
  useEffect(() => {
    if (queue.queueState === 'matched' && queue.matchedRoomCode !== null && queue.matchedPlayerIndex !== null) {
      sessionStorage.setItem(`room:${queue.matchedRoomCode}:playerIndex`, String(queue.matchedPlayerIndex));
      sessionStorage.setItem(`room:${queue.matchedRoomCode}:isMatchmaking`, 'true');
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
    queue.joinRated(variant, guestSession.guestId, session.user.id, session.user.name ?? guestSession.displayName);
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
            <h1 className={styles.title}>
              <Grid3x3 size={36} strokeWidth={2.5} color="url(#logo-grad)" />
              <div>
                <span style={{ color: '#ef4444' }}>TIC</span>
                <span style={{ color: '#3b82f6' }}>TAC</span>
                <span style={{ color: '#f59e0b' }}>TOP</span>
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
              <div className={styles.variantInfo} title={GAME_VARIANTS.find(v => v.id === variant)?.description}>
                <HelpCircle size={14} style={{ marginRight: 4 }} />
                {GAME_VARIANTS.find(v => v.id === variant)?.description}
              </div>
              <a href={`/learn#${variant}`} className={styles.learnMoreLink}>
                Learn more →
              </a>
            </div>
          </div>
          <div className={styles.variantButtons}>
            {GAME_VARIANTS.filter(v => tab !== 'ranked' || v.allowRated).map(({ id, name }) => {
              const Icon = VARIANT_ICONS[id];
              return (
                <button
                  key={id}
                  className={`${styles.variantBtn} ${variant === id ? styles.selected : ''}`}
                  onClick={() => setVariant(id)}
                >
                  <Icon size={16} strokeWidth={2.5} style={{ marginBottom: 4 }} />
                  <span>{name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Play mode tabs */}
        <div className={styles.tabs} style={{ marginTop: 'var(--space-5)' }}>
          <button className={`${styles.tab} ${tab === 'quick' ? styles.activeTab : ''}`} onClick={() => handleTabChange('quick')}>
            Quick Match
          </button>
          <button className={`${styles.tab} ${tab === 'ranked' ? styles.activeTab : ''}`} onClick={() => handleTabChange('ranked')}>
            Ranked
          </button>
          <button className={`${styles.tab} ${tab === 'private' ? styles.activeTab : ''}`} onClick={() => handleTabChange('private')}>
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
                  {GAME_VARIANTS.find(v => v.id === variant)?.name} · Rated
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
