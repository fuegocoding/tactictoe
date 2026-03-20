'use client';

import { SessionProvider } from 'next-auth/react';
import { useEffect } from 'react';
import { ThemeProvider } from '@/context/ThemeContext';

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
        <GuestSessionInitializer />
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
