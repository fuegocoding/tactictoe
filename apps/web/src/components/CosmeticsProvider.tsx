'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { CosmeticsContext } from './CosmeticsContext';

const CSS_VAR_KEYS = [
  '--board-cell-bg',
  '--board-cell-border',
  '--board-active-border',
  '--board-inactive-border',
  '--mark-x',
  '--mark-o',
  '--winline-color',
  '--winline-width',
  '--winline-filter',
  '--chess-light',
  '--chess-dark',
];

export default function CosmeticsProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [symbolX, setSymbolX] = useState('X');
  const [symbolO, setSymbolO] = useState('O');
  const [chessSet, setChessSet] = useState('cburnett');

  useEffect(() => {
    const loadCosmetics = async () => {
      if (status === 'loading') return;
      try {
        const res = await fetch('/api/cosmetics');
        const data = await res.json();
        if (!data.cosmetics) return;

        let equipped = data.cosmetics.filter((c: any) => c.isEquipped);

        if (status === 'unauthenticated') {
          const guestSave = localStorage.getItem('guest_cosmetics');
          if (guestSave) {
            try {
              const savedIds = JSON.parse(guestSave) as string[];
              equipped = data.cosmetics.filter((c: any) => savedIds.includes(c.id));
            } catch (e) {
              console.warn('Failed to parse guest cosmetics from localStorage:', e);
            }
          }
        }

        // Reset all CSS vars to defaults
        const overrides: Record<string, string> = Object.fromEntries(
          CSS_VAR_KEYS.map((k) => [k, ''])
        );

        let nextSymbolX = 'X';
        let nextSymbolO = 'O';
        let nextChessSet = 'cburnett';

        for (const c of equipped) {
          try {
            const parsed = JSON.parse(c.cssValue);
            // Extract non-CSS fields before merging
            if (parsed.symbolX) nextSymbolX = parsed.symbolX;
            if (parsed.symbolO) nextSymbolO = parsed.symbolO;
            if (parsed.set) nextChessSet = parsed.set;
            // Merge only CSS var keys
            for (const key of CSS_VAR_KEYS) {
              if (parsed[key] !== undefined) overrides[key] = parsed[key];
            }
          } catch (e) {
            console.error(`Failed to parse cosmetic cssValue for cosmetic ${c.id}:`, e);
          }
        }

        for (const [key, value] of Object.entries(overrides)) {
          if (value === '') {
            document.documentElement.style.removeProperty(key);
          } else {
            document.documentElement.style.setProperty(key, value);
          }
        }

        setSymbolX(nextSymbolX);
        setSymbolO(nextSymbolO);
        setChessSet(nextChessSet);
      } catch (e) {
        console.error('Failed to load cosmetics', e);
      }
    };

    loadCosmetics();

    const handleUpdate = () => loadCosmetics();
    window.addEventListener('cosmetics_updated', handleUpdate);
    return () => window.removeEventListener('cosmetics_updated', handleUpdate);
  }, [status]);

  return (
    <CosmeticsContext.Provider value={{ symbolX, symbolO, chessSet }}>
      {children}
    </CosmeticsContext.Provider>
  );
}
