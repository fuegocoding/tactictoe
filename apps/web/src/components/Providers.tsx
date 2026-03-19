'use client';

import { SessionProvider } from 'next-auth/react';
import { useEffect } from 'react';

function GuestSessionInitializer() {
  useEffect(() => {
    // On mount, ensure a guest session exists (creates one if none/expired).
    // All users (including authenticated ones) maintain a guestId for socket identity.
    fetch('/api/guest-session', { method: 'POST' }).catch(() => {
      // Non-fatal — guest session is best-effort
    });
  }, []);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <GuestSessionInitializer />
      {children}
    </SessionProvider>
  );
}
