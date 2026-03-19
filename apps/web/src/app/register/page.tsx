'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    });

    if (!res.ok) {
      const data = await res.json() as { error?: string };
      setError(data.error ?? 'Registration failed');
      setLoading(false);
      return;
    }

    await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    router.push('/');
  }

  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
      <h1>Create account</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: 8, fontSize: 16 }} />
        <input type="text" placeholder="Username (3–20 chars, letters/numbers/_)" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={20} style={{ padding: 8, fontSize: 16 }} />
        <input type="password" placeholder="Password (8+ chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} style={{ padding: 8, fontSize: 16 }} />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: '10px 0', fontSize: 16 }}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p style={{ marginTop: 16, textAlign: 'center' }}>
        Already have an account? <a href="/login">Sign in</a>
      </p>
    </main>
  );
}
