import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import ThemeToggle from './ThemeToggle';
import Button from './ui/Button';
import styles from './Nav.module.css';

export default async function Nav() {
  const session = await getServerSession(authOptions);

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          Tactic<span>Toe</span>
        </Link>

        <div className={styles.spacer} />

        <div className={styles.actions}>
          <ThemeToggle />
          {session?.user ? (
            <span className={styles.username}>{session.user.name ?? session.user.email}</span>
          ) : (
            <>
              <Link href="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
              <Link href="/register"><Button variant="primary" size="sm">Register</Button></Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
