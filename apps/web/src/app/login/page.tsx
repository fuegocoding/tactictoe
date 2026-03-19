'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError('Invalid email or password');
    } else {
      router.push('/');
    }
  }

  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
      <h1>Sign in</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: 8, fontSize: 16 }} />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ padding: 8, fontSize: 16 }} />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: '10px 0', fontSize: 16 }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <hr style={{ margin: '24px 0' }} />
      <button onClick={() => signIn('google', { callbackUrl: '/' })} style={{ width: '100%', padding: '10px 0', fontSize: 16 }}>
        Continue with Google
      </button>
      <p style={{ marginTop: 16, textAlign: 'center' }}>
        No account? <a href="/register">Register</a>
      </p>
    </main>
  );
}
