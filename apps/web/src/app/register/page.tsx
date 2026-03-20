'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import styles from '../login/page.module.css';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Registration failed'); setLoading(false); return; }
    await signIn('credentials', { email, password, redirect: false });
    router.push('/');
  };

  return (
    <div className={styles.page}>
      <Card className={styles.card}>
        <h1 className={styles.title}>Create account</h1>
        <p className={styles.subtitle}>Join TacticToe and start playing.</p>

        {error && <div className={styles.error}>{error}</div>}

        <form className={styles.form} onSubmit={handleSubmit}>
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
          <Input
            label="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            hint="3–20 characters. Letters, numbers, underscores."
            pattern="^[a-zA-Z0-9_]{3,20}$"
            required
          />
          <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} hint="At least 8 characters." minLength={8} required />
          <Button type="submit" loading={loading} full>Create account</Button>
        </form>

        <div className={styles.divider}>or</div>

        <Button variant="secondary" full onClick={() => signIn('google', { callbackUrl: '/' })}>
          Continue with Google
        </Button>

        <p className={styles.footer}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
