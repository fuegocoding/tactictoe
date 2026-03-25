'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PieceSymbol } from '@/components/board/PieceSymbol';
import styles from './page.module.css';

interface Cosmetic {
  id: string;
  name: string;
  type: 'board' | 'piece' | 'winline';
  cssValue: string;
  requiredScore: number;
  price: number;
  isUnlocked: boolean;
  isEquipped: boolean;
}

export default function ShopPage() {
  const { data: session, status } = useSession();
  const [cosmetics, setCosmetics] = useState<Cosmetic[]>([]);
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchCosmetics = async () => {
    try {
      const res = await fetch('/api/cosmetics');
      const data = await res.json();
      if (data.cosmetics) {
        setCosmetics(data.cosmetics);
        setCredits(data.credits ?? 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status !== 'loading') {
      fetchCosmetics();
    }
  }, [status]);

  const handleBuy = async (c: Cosmetic) => {
    if (!session?.user) {
      setErrorMsg('You must be logged in to buy cosmetics.');
      return;
    }

    if (credits < c.price) {
      setErrorMsg('Not enough credits!');
      return;
    }

    setPurchasing(c.id);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cosmeticId: c.id })
      });
      const data = await res.json();

      if (data.success) {
        setCredits(data.credits);
        setCosmetics(prev => prev.map(item =>
          item.id === c.id ? { ...item, isUnlocked: true } : item
        ));
      } else {
        setErrorMsg(data.error || 'Failed to purchase.');
      }
    } catch (err) {
      setErrorMsg('An error occurred.');
    } finally {
      setPurchasing(null);
    }
  };

  const buyableCosmetics = cosmetics.filter(c => c.price > 0 && !c.isUnlocked);
  const boards = buyableCosmetics.filter(c => c.type === 'board');
  const pieces = buyableCosmetics.filter(c => c.type === 'piece');
  const winlines = buyableCosmetics.filter(c => c.type === 'winline');

  if (loading) return <div className={styles.loading}>Loading shop...</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Shop</h1>
        <p className={styles.subtitle}>
          {session?.user ? `You have ${credits} credits.` : 'Log in to buy exclusive themes with credits!'}
        </p>
        {errorMsg && <p style={{ color: 'var(--text-danger)', marginTop: '8px' }}>{errorMsg}</p>}
      </div>

      {buyableCosmetics.length === 0 ? (
        <div className={styles.section}>
          <p>You have unlocked all available items in the shop!</p>
        </div>
      ) : null}

      {boards.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Board Themes</h2>
          <div className={styles.grid}>
            {boards.map(c => (
              <Card key={c.id} className={styles.card}>
                 <div className={styles.preview} style={JSON.parse(c.cssValue)}>
                   <div className={styles.previewBoard}>
                      <div className={styles.previewCell} />
                      <div className={styles.previewCell} style={{ background: 'var(--board-result-overlay)' }} />
                      <div className={styles.previewCell} />
                      <div className={styles.previewCell} style={{ borderColor: 'var(--board-active-border)' }} />
                   </div>
                 </div>
                 <div className={styles.info}>
                   <h3>{c.name}</h3>
                   <p className={styles.requirement}>Price: {c.price} credits</p>
                   <Button
                     variant="primary"
                     onClick={() => handleBuy(c)}
                     disabled={purchasing === c.id || credits < c.price || !session?.user}
                   >
                     {purchasing === c.id ? 'Buying...' : 'Buy'}
                   </Button>
                 </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {pieces.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Piece Themes</h2>
          <div className={styles.grid}>
            {pieces.map(c => {
              const cv = JSON.parse(c.cssValue) as Record<string, string>;
              const sx = cv['symbolX'] ?? 'X';
              const so = cv['symbolO'] ?? 'O';
              return (
                <Card key={c.id} className={styles.card}>
                  <div className={styles.preview} style={cv}>
                    <div className={styles.previewPieces}>
                      <PieceSymbol symbol={sx} color="var(--mark-x)" size={40} />
                      <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>vs</span>
                      <PieceSymbol symbol={so} color="var(--mark-o)" size={40} />
                    </div>
                  </div>
                  <div className={styles.info}>
                    <h3>{c.name}</h3>
                    <p className={styles.requirement}>Price: {c.price} credits</p>
                    <Button
                      variant="primary"
                      onClick={() => handleBuy(c)}
                      disabled={purchasing === c.id || credits < c.price || !session?.user}
                    >
                      {purchasing === c.id ? 'Buying...' : 'Buy'}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {winlines.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Win Line Skins</h2>
          <div className={styles.grid}>
            {winlines.map(c => {
              const cv = JSON.parse(c.cssValue) as Record<string, string>;
              return (
                <Card key={c.id} className={styles.card}>
                  <div className={styles.previewWinLine} style={cv}>
                    <svg viewBox="0 0 3 3" className={styles.winLinePreviewSvg}>
                      <line
                        x1="0.3" y1="0.3" x2="2.7" y2="2.7"
                        stroke="var(--winline-color, #3b82f6)"
                        strokeLinecap="round"
                        style={{ filter: 'var(--winline-filter, none)', strokeWidth: '0.28' }}
                      />
                    </svg>
                  </div>
                  <div className={styles.info}>
                    <h3>{c.name}</h3>
                    <p className={styles.requirement}>Price: {c.price} credits</p>
                    <Button
                      variant="primary"
                      onClick={() => handleBuy(c)}
                      disabled={purchasing === c.id || credits < c.price || !session?.user}
                    >
                      {purchasing === c.id ? 'Buying...' : 'Buy'}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
