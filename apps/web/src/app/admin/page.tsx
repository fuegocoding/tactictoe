'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

interface Stats {
  totalUsers: number;
  totalMatches: number;
  activeGuests: number;
  totalRatings: number;
}

interface UserDto {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  username?: string;
  displayName?: string;
  rating: number;
  wins: number;
  losses: number;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'ADMIN') {
      router.replace('/');
      return;
    }

    Promise.all([
      fetch('/api/admin/stats').then(async r => { if (!r.ok) throw new Error('Stats Error'); return r.json() }),
      fetch('/api/admin/users').then(async r => { if (!r.ok) throw new Error('Users Error'); return r.json() })
    ]).then(([st, us]) => {
      setStats(st);
      if (us.users) setUsers(us.users);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setError('Failed to securely fetch dashboard metrics. Check server logs.');
      setLoading(false);
    });
  }, [session, status, router]);

  if (status === 'loading' || loading) return <div className={styles.loading}>Loading secure dashboard...</div>;
  if (!session || session.user.role !== 'ADMIN') return null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Admin Dashboard</h1>
        <p className={styles.subtitle}>System Telemetry & User Rosters.</p>
      </div>

      {error ? (
        <div style={{ color: 'var(--error)', marginBottom: 'var(--space-6)', fontWeight: 'bold' }}>
          {error}
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Total Users</span>
              <span className={styles.statValue}>{stats?.totalUsers ?? 0}</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Matches Played</span>
              <span className={styles.statValue}>{stats?.totalMatches ?? 0}</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Live Guests</span>
              <span className={styles.statValue}>{stats?.activeGuests ?? 0}</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Ranked ELO Objects</span>
              <span className={styles.statValue}>{stats?.totalRatings ?? 0}</span>
            </div>
          </div>

          <h2 style={{ marginBottom: '16px', fontSize: '20px', fontWeight: 600 }}>Registered Roster</h2>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Ultimate Rating</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{u.displayName ?? 'Unknown'}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>@{u.username ?? u.id.slice(0,8)}</div>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`${styles.roleBadge} ${u.role === 'ADMIN' ? styles.roleAdmin : styles.roleUser}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{u.rating}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>{u.wins}W - {u.losses}L</div>
                    </td>
                    <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
                      No registered players found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
