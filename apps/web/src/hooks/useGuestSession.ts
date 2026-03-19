'use client';

import { useState, useEffect } from 'react';

export interface GuestSession {
  guestId: string;
  displayName: string;
}

export function useGuestSession(): GuestSession | null {
  const [guest, setGuest] = useState<GuestSession | null>(null);

  useEffect(() => {
    // Use POST (not GET) to create-or-renew in one shot.
    // This eliminates the race between GuestSessionInitializer and this hook:
    // the POST returns the session whether it was just created or already existed.
    fetch('/api/guest-session', { method: 'POST' })
      .then((r) => r.json())
      .then((data: { guest: GuestSession | null }) => {
        setGuest(data.guest);
      })
      .catch(() => {
        // Non-fatal
      });
  }, []);

  return guest;
}
