'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import ThemeToggle from './ThemeToggle';
import Button from './ui/Button';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.logo}>
        Tactic<span>Toe</span>
      </Link>

      <nav className={styles.navLinks}>
        <Link href="/" className={`${styles.navItem} ${pathname === '/' ? styles.active : ''}`}>
          <span className={styles.icon}>🌐</span>
          <span className={styles.navLabel}>Play Online</span>
        </Link>
        <Link href="/local" className={`${styles.navItem} ${pathname === '/local' ? styles.active : ''}`}>
          <span className={styles.icon}>🤝</span>
          <span className={styles.navLabel}>Play Local</span>
        </Link>
        <Link href="/puzzles" className={`${styles.navItem} ${pathname === '/puzzles' ? styles.active : ''}`}>
          <span className={styles.icon}>🧩</span>
          <span className={styles.navLabel}>Puzzles</span>
        </Link>
        <Link href="/learn" className={`${styles.navItem} ${pathname === '/learn' ? styles.active : ''}`}>
          <span className={styles.icon}>🎓</span>
          <span className={styles.navLabel}>Learn</span>
        </Link>
      </nav>

      <div className={styles.spacer} />

      <div className={styles.profileSection}>
        {session?.user ? (
          <div className={styles.userInfo}>
            <span className={styles.userName}>{session.user.name ?? 'Player'}</span>
            <span className={styles.userStatus}>Online</span>
          </div>
        ) : (
          <div className={styles.actions}>
            <Link href="/login" style={{ width: '100%' }}>
              <Button variant="secondary" full>Sign In</Button>
            </Link>
            <Link href="/register" style={{ width: '100%' }}>
              <Button variant="primary" full>Sign Up</Button>
            </Link>
          </div>
        )}
        <div className={styles.themeToggleWrap}>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
