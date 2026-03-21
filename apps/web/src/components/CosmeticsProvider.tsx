'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

export default function CosmeticsProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();

  // Need to extract the default variables on the first pass so we can revert when unequal
  // But CSS variables are inherited, we just reset them to '' and let CSS fallback to root!
  
  useEffect(() => {
    const loadCosmetics = async () => {
      if (status === 'loading') return;
      try {
        const res = await fetch('/api/cosmetics');
        const data = await res.json();
        if (data.cosmetics) {
          let equipped = data.cosmetics.filter((c: any) => c.isEquipped);
          
          if (status === 'unauthenticated') {
             const guestSave = localStorage.getItem('guest_cosmetics');
             if (guestSave) {
               try {
                 const savedIds = JSON.parse(guestSave) as string[];
                 equipped = data.cosmetics.filter((c: any) => savedIds.includes(c.id));
               } catch (e) {}
             }
          }

          const overrides: Record<string, string> = {
            '--board-cell-bg': '',
            '--board-cell-border': '',
            '--board-active-border': '',
            '--board-inactive-border': '',
            '--mark-x': '',
            '--mark-o': ''
          };

          for (const c of equipped) {
             try {
               const parsed = JSON.parse(c.cssValue);
               Object.assign(overrides, parsed);
             } catch (e) {}
          }
          
          for (const [key, value] of Object.entries(overrides)) {
             if (value === '') {
                document.documentElement.style.removeProperty(key);
             } else {
                document.documentElement.style.setProperty(key, value as string);
             }
          }
        }
      } catch (e) {
        console.error('Failed to load cosmetics', e);
      }
    };

    loadCosmetics();
    
    // Listen for custom event from SettingsPage
    const handleUpdate = () => loadCosmetics();
    window.addEventListener('cosmetics_updated', handleUpdate);
    return () => window.removeEventListener('cosmetics_updated', handleUpdate);
  }, [status]);

  return <>{children}</>;
}
