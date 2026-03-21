'use client';

import { SessionProvider } from 'next-auth/react';
import { useEffect } from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import CosmeticsProvider from '@/components/CosmeticsProvider';

function GuestSessionInitializer() {
  useEffect(() => {
    fetch('/api/guest-session', { method: 'POST' }).catch(() => {});
  }, []);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <CosmeticsProvider>
          <GuestSessionInitializer />
          {children}
        </CosmeticsProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
