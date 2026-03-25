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
  isUnlocked: boolean;
  isEquipped: boolean;
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [cosmetics, setCosmetics] = useState<Cosmetic[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCosmetics = async () => {
    try {
      const res = await fetch('/api/cosmetics');
      const data = await res.json();
      if (data.cosmetics) {
        let loaded = data.cosmetics;
        
        // Merge guest localStorage overrides if not logged in
        if (!session?.user) {
          const guestSave = localStorage.getItem('guest_cosmetics');
          if (guestSave) {
            try {
              const savedIds = JSON.parse(guestSave) as string[];
              loaded = loaded.map((c: Cosmetic) => ({
                ...c,
                isEquipped: savedIds.includes(c.id)
              }));
            } catch (e) {}
          }
        }
        
        setCosmetics(loaded);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleEquip = async (c: Cosmetic) => {
    if (!c.isUnlocked) return;
    
    // Optimistic update
    const nextCosmetics = cosmetics.map(item => {
      if (item.type === c.type) {
        return { ...item, isEquipped: item.id === c.id ? !c.isEquipped : false };
      }
      return item;
    });
    setCosmetics(nextCosmetics);

    if (session?.user) {
      await fetch('/api/cosmetics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cosmeticId: c.id, equip: !c.isEquipped })
      });
      window.dispatchEvent(new Event('cosmetics_updated'));
    } else {
      const equippedIds = nextCosmetics.filter(x => x.isEquipped).map(x => x.id);
      localStorage.setItem('guest_cosmetics', JSON.stringify(equippedIds));
      // Dispatch custom event so the Sidebar/Layout can pick up the styles instantly
      window.dispatchEvent(new Event('cosmetics_updated'));
    }
  };

  const boards = cosmetics.filter(c => c.type === 'board');
  const pieces = cosmetics.filter(c => c.type === 'piece');
  const winlines = cosmetics.filter(c => c.type === 'winline');

  if (loading) return <div className={styles.loading}>Loading cosmetics...</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Customize your board and pieces. Higher ratings unlock exclusive themes!</p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Board Themes</h2>
        <div className={styles.grid}>
          {boards.map(c => (
            <Card key={c.id} className={`${styles.card} ${c.isEquipped ? styles.equipped : ''} ${!c.isUnlocked ? styles.locked : ''}`}>
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
                 <p className={styles.requirement}>{c.requiredScore > 0 ? `Unlocks at ${c.requiredScore} Rating` : 'Starter Edition'}</p>
                 <Button 
                   variant={c.isEquipped ? 'secondary' : 'primary'} 
                   onClick={() => handleEquip(c)}
                   disabled={!c.isUnlocked}
                 >
                   {c.isEquipped ? 'Unequip' : c.isUnlocked ? 'Equip' : 'Locked'}
                 </Button>
               </div>
            </Card>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Piece Themes</h2>
        <div className={styles.grid}>
          {pieces.map(c => {
            const cv = JSON.parse(c.cssValue) as Record<string, string>;
            const sx = cv['symbolX'] ?? 'X';
            const so = cv['symbolO'] ?? 'O';
            return (
              <Card key={c.id} className={`${styles.card} ${c.isEquipped ? styles.equipped : ''} ${!c.isUnlocked ? styles.locked : ''}`}>
                <div className={styles.preview} style={cv}>
                  <div className={styles.previewPieces}>
                    <PieceSymbol symbol={sx} color="var(--mark-x)" size={40} />
                    <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>vs</span>
                    <PieceSymbol symbol={so} color="var(--mark-o)" size={40} />
                  </div>
                </div>
                <div className={styles.info}>
                  <h3>{c.name}</h3>
                  <p className={styles.requirement}>{c.requiredScore > 0 ? `Unlocks at ${c.requiredScore} Rating` : 'Starter Edition'}</p>
                  <Button
                    variant={c.isEquipped ? 'secondary' : 'primary'}
                    onClick={() => handleEquip(c)}
                    disabled={!c.isUnlocked}
                  >
                    {c.isEquipped ? 'Unequip' : c.isUnlocked ? 'Equip' : 'Locked'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Win Line Skins</h2>
        <div className={styles.grid}>
          {winlines.map(c => {
            const cv = JSON.parse(c.cssValue) as Record<string, string>;
            return (
              <Card key={c.id} className={`${styles.card} ${c.isEquipped ? styles.equipped : ''} ${!c.isUnlocked ? styles.locked : ''}`}>
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
                  <p className={styles.requirement}>{c.requiredScore > 0 ? `Unlocks at ${c.requiredScore} Rating` : 'Starter Edition'}</p>
                  <Button
                    variant={c.isEquipped ? 'secondary' : 'primary'}
                    onClick={() => handleEquip(c)}
                    disabled={!c.isUnlocked}
                  >
                    {c.isEquipped ? 'Unequip' : c.isUnlocked ? 'Equip' : 'Locked'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
